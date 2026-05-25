/**
 * @module onboardingImportService
 * @description Orquestador de la importación de usuarios para onboarding.
 *
 * Dos fases:
 *   1. previewImport(buffer, mimetype, originalname, organizationId, actingUserId, options?)
 *      Parsea + valida + cruza con BD → resumen sin persistir.
 *   2. applyImport(previewToken, organizationId, actingUserId, roleMappings?, ...)
 *      Persiste usuarios válidos.
 *
 * Seguridad:
 *   - El previewToken se genera con crypto.randomBytes y queda atado a (organizationId, actingUserId).
 *   - El cache NUNCA guarda contraseñas en claro.
 *   - Las colisiones de email se evalúan globalmente; userName es único por (organization_id, user_name).
 */
import crypto from "crypto";
import bcrypt from "bcrypt";
import {
  findRoleByNameInOrg,
  findRoleByIdForTemplate,
  findActivePermissionsByCodes,
  createImportCustomRole,
  attachPermissionsToRole,
  listRolesByOrg,
  findExistingUsersByUsername,
  findExistingUsersByEmail,
  createImportedUser,
  upsertEmpleadoForImport,
  updateUserPartial,
  grantUserPermissions,
  findManagersByNoEmpleado,
  findUsersByUsernameInOrg,
  findAdminRoleInOrg,
  findExistingAdminUser,
  upsertAccountingSociety,
  upsertDepartmentForImport,
} from "~/contexts/onboarding/infrastructure/onboardingImportQueries.js";
import { resolveImportStrategy } from "~/contexts/onboarding/application/importStrategyResolver.js";
import {
  validateImportRows,
  isValidImportPassword,
  type ProcessedImportRow,
} from "~/contexts/onboarding/application/onboardingImportValidationService.js";
import {
  resolveImportRole,
  resolveManualRoleMapping,
} from "~/contexts/onboarding/application/importRoleResolution.js";
import { loadEffectivePermissionsForRole } from "~/platform/permissions/permission-service.server.js";
import { buildPermissionsCatalogGrouped } from "~/contexts/onboarding/application/permissionCatalog.js";
import {
  getDefaultClientRoleNamesForOnboardingImport,
  getDefaultRolePreviewPermissionCodes,
} from "@coco/db";
import { createClientOrganizationOnly } from "~/contexts/organizations/application/organizationService.js";
import { ensureTenantApplicantUserPermissions } from "~/contexts/organizations/application/tenantApplicantUserGrants.js";
import type {
  ApplyImportFailure,
  ApplyImportResult,
  CreatedImportUser,
  CustomImportRoleSpec,
  ImportSociety,
  ImportDepartment,
  ImportUserPreviewRow,
  OrganizationCreateSpec,
  PreviewImportResult,
  RoleCatalogEntry,
} from "~/contexts/onboarding/domain/entities/ImportUser";
import type {
  ApplyImportOptions,
  PreviewImportOptions,
} from "~/contexts/onboarding/domain/ports/OnboardingImportService";

const SALT_ROUNDS = 10;

type OrgRole = { roleName: string; roleId: number };

type PreviewCacheEntry = {
  rows: ProcessedImportRow[];
  societies: ImportSociety[];
  departments: ImportDepartment[];
  organizationId: bigint;
  actingUserId: bigint;
  orgRoles: OrgRole[];
  validRoleNames: string[];
  expiresAt: number;
  createNewOrganization: boolean;
  newOrgSpec?: OrganizationCreateSpec | null;
};

/** Contraseña temporal para admin bootstrap (solo se devuelve una vez). */
function generateBootstrapAdminPassword(): string {
  return crypto.randomBytes(16).toString("base64url");
}

const previewCache = new Map<string, PreviewCacheEntry>();
const PREVIEW_TTL_MS = 10 * 60 * 1000;

/** Nombre base del rol creado en import (máx. 40 chars en BD). */
function buildImportCustomRoleBaseName(userName: string): string {
  const u = String(userName ?? "").trim() || "user";
  const prefix = "Imp·";
  const combined = prefix + u;
  return combined.length <= 40 ? combined : combined.slice(0, 40);
}

async function uniqueRoleNameInOrg(organizationId: bigint, desired: string): Promise<string> {
  const root = String(desired ?? "").trim().slice(0, 40) || "Imp·rol";
  for (let i = 0; i < 200; i++) {
    const suffix = i === 0 ? "" : `·${i}`;
    const candidate = (root.slice(0, 40 - suffix.length) + suffix).slice(0, 40);
    const exists = await findRoleByNameInOrg(organizationId, candidate);
    if (!exists) return candidate;
  }
  throw new Error("No se pudo generar un nombre de rol único para la importación.");
}

/** Crea roles «a medida» antes de validar overrides. */
async function createCustomImportRolesInApply(opts: {
  organizationId: bigint;
  roleMap: Map<string, number>;
  validRoleNames: string[];
  rows: ProcessedImportRow[];
  customImportRolesByUser: Record<string, CustomImportRoleSpec>;
}): Promise<Record<string, string>> {
  const { organizationId, roleMap, validRoleNames, rows, customImportRolesByUser } = opts;
  const applyable = new Set(rows.map((r) => String(r.userName ?? "").trim()).filter(Boolean));
  const out: Record<string, string> = {};

  const specs =
    customImportRolesByUser &&
    typeof customImportRolesByUser === "object" &&
    !Array.isArray(customImportRolesByUser)
      ? customImportRolesByUser
      : {};

  for (const [userNameRaw, spec] of Object.entries(specs)) {
    const userName = String(userNameRaw ?? "").trim();
    if (!userName || !applyable.has(userName)) {
      throw new Error(`customImportRoles: el usuario «${userName || userNameRaw}» no está en la importación.`);
    }
    const s = spec && typeof spec === "object" ? spec : ({} as Partial<CustomImportRoleSpec>);
    const templateRoleName = String(s.templateRoleName ?? "").trim();
    const permissionsRaw = Array.isArray(s.permissions) ? s.permissions : [];
    const permissions = [...new Set(permissionsRaw.map((c) => String(c ?? "").trim()).filter(Boolean))];

    if (!templateRoleName) {
      throw new Error(`customImportRoles[${userName}]: falta «templateRoleName» (rol base).`);
    }
    if (permissions.length === 0) {
      throw new Error(`customImportRoles[${userName}]: la lista de permisos no puede estar vacía.`);
    }

    const templateId = roleMap.get(templateRoleName.toLowerCase());
    if (!templateId) {
      throw new Error(
        `customImportRoles[${userName}]: el rol base «${templateRoleName}» no existe en esta organización.`,
      );
    }

    const templateRow = await findRoleByIdForTemplate(templateId);
    if (!templateRow || BigInt(templateRow.organizationId) !== BigInt(organizationId)) {
      throw new Error(`customImportRoles[${userName}]: rol base inválido.`);
    }

    const permRows = await findActivePermissionsByCodes(permissions);
    const foundCodes = new Set(permRows.map((p) => p.code));
    const missing = permissions.filter((c) => !foundCodes.has(c));
    if (missing.length > 0) {
      throw new Error(
        `customImportRoles[${userName}]: permisos no válidos o inactivos en catálogo: ${missing.join(", ")}`,
      );
    }

    const desiredName = await uniqueRoleNameInOrg(organizationId, buildImportCustomRoleBaseName(userName));

    const newRole = await createImportCustomRole({
      organizationId,
      roleName: desiredName,
      maxApprovalAmount: templateRow.maxApprovalAmount ?? null,
      isSystem: false,
    });

    await attachPermissionsToRole(
      permRows.map((p) => ({ roleId: newRole.roleId, permissionId: p.permissionId })),
    );

    roleMap.set(newRole.roleName.toLowerCase(), newRole.roleId);
    validRoleNames.push(newRole.roleName);
    out[userName] = newRole.roleName;
  }

  return out;
}

/** 32 bytes hex = 64 chars; no predecible. */
function generatePreviewToken(): string {
  return `prev_${crypto.randomBytes(32).toString("hex")}`;
}

function sameBigInt(a: bigint | number | string, b: bigint | number | string): boolean {
  try {
    return BigInt(a) === BigInt(b);
  } catch {
    return false;
  }
}

function buildPreviewRow(
  row: ProcessedImportRow,
  roleNameToId: Map<string, number>,
  permByRoleId: Map<number, string[]>,
): ImportUserPreviewRow {
  const canonical = row.mappedRoleName;
  const rid = canonical ? roleNameToId.get(canonical.toLowerCase()) : undefined;
  const rolePermissionCodes = rid !== undefined && rid !== null ? permByRoleId.get(rid) ?? [] : [];

  return {
    userName: row.userName,
    email: row.email,
    department: row.department,
    firstName: row.firstName,
    lastName: row.lastName,
    roleName: canonical ?? undefined,
    externalRoleLabel: row.externalRoleLabel ?? undefined,
    needsRoleMapping: Boolean(row.externalRoleLabel && !row.mappedRoleName),
    rolePermissionCodes,
    effectivePermissions: rolePermissionCodes,
    hasFilePassword: Boolean(row.hasFilePassword),
  };
}

function pickRoleMapping(
  label: string | null | undefined,
  roleMappings: Record<string, string>,
): string | null {
  if (!label) return null;
  const direct = roleMappings[label];
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const hit = Object.entries(roleMappings).find(
    ([k]) => k.trim().toLowerCase() === String(label).trim().toLowerCase(),
  );
  return typeof hit?.[1] === "string" ? hit[1].trim() : null;
}

function validatePasswordApplyOptions(perUser: Record<string, string>, globalTrim: string): void {
  if (globalTrim && !isValidImportPassword(globalTrim)) {
    throw new Error(
      "La contraseña global no cumple las reglas: mínimo 8 caracteres, una mayúscula, una minúscula y un número.",
    );
  }
  for (const [uname, pwd] of Object.entries(perUser)) {
    const t = String(pwd ?? "").trim();
    if (t && !isValidImportPassword(t)) {
      throw new Error(
        `La contraseña para «${uname}» no cumple las reglas (mínimo 8 caracteres, mayúscula, minúscula y número).`,
      );
    }
  }
}

function resolvePlainPassword(
  userName: string,
  perUser: Record<string, string>,
  globalTrim: string,
): string | null {
  const specific = String(perUser[userName] ?? "").trim();
  if (specific) return specific;
  if (globalTrim) return globalTrim;
  return null;
}

function buildEmpleadoNombre(row: ProcessedImportRow): string {
  const fn = String(row.firstName ?? "").trim();
  const ln = String(row.lastName ?? "").trim();
  const full = `${fn} ${ln}`.trim();
  return full || String(row.userName ?? "").trim();
}

function fallbackProveedorFromUserId(userId: number): string {
  const base = 20000000000n + BigInt(Number(userId));
  return base.toString().padStart(11, "0").slice(-11);
}

function validateImportOrganizationSpec(spec: OrganizationCreateSpec): void {
  if (spec.rfc && !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i.test(spec.rfc)) {
    throw new Error('El RFC del bloque "organization" del JSON no cumple el formato SAT.');
  }
}

/** Type guard para el error Prisma P2002 (unique violation). */
function isPrismaUniqueError(e: unknown): e is { code: string; meta?: { target?: unknown } } {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: unknown }).code === "P2002"
  );
}

/**
 * Fase 1: parsea el archivo, valida DTOs, cruza userNames/emails contra la BD.
 */
export async function previewImport(
  buffer: Buffer,
  mimetype: string,
  originalname: string,
  organizationId: bigint | number | string,
  actingUserId: bigint | number | string,
  options: PreviewImportOptions = {},
): Promise<PreviewImportResult> {
  const createNewOrganization = Boolean(options.createNewOrganization);
  const actorHasOrganizationCreate = Boolean(options.actorHasOrganizationCreate);

  const orgIdBig = BigInt(organizationId);
  if (actingUserId === undefined || actingUserId === null) {
    throw new Error("Falta actingUserId para emitir el token de previsualización.");
  }
  const actingUserIdBig = BigInt(actingUserId);

  const strategy = resolveImportStrategy(mimetype, originalname);
  const parsed = await strategy.parse(buffer);
  const rows = parsed.rows;
  const embeddedRoleMappings = parsed.embeddedRoleMappings ?? {};
  const organizationSpec = parsed.organizationSpec ?? null;
  const societies = parsed.societies ?? [];
  const departments = parsed.departments ?? [];

  let orgRoles: OrgRole[];
  let validRoleNames: string[];

  if (createNewOrganization) {
    if (strategy.label !== "JSON") {
      throw new Error("La creación de una organización nueva solo está disponible con archivos JSON.");
    }
    if (!actorHasOrganizationCreate) {
      throw new Error("No tienes permiso para crear una organización nueva (organization:create).");
    }
    if (!organizationSpec?.nombre?.trim()) {
      throw new Error(
        'Para crear una organización nueva, el JSON debe incluir un objeto "organization" con al menos "nombre".',
      );
    }
    validateImportOrganizationSpec(organizationSpec);
    const defaultRoleNames: string[] = getDefaultClientRoleNamesForOnboardingImport();
    validRoleNames = defaultRoleNames;
    orgRoles = validRoleNames.map((roleName, i) => ({ roleName, roleId: -(i + 1) }));
  } else {
    orgRoles = await listRolesByOrg(orgIdBig);
    validRoleNames = orgRoles.map((r) => r.roleName);
  }

  const processedRows: ProcessedImportRow[] = rows.map((r) => {
    const rawRole = String(r.roleName ?? "").trim();
    const { mappedRoleName, externalRoleLabel } = resolveImportRole(
      rawRole,
      validRoleNames,
      embeddedRoleMappings,
    );
    return {
      ...r,
      hasFilePassword: Boolean(String(r.password ?? "").trim()),
      mappedRoleName,
      externalRoleLabel,
    };
  });

  const { valid, errors } = validateImportRows(processedRows, validRoleNames);

  const userNamesToCheck = valid.map((r) => r.userName);
  const emailsToCheck = valid.map((r) => r.email);

  const existingByUsername = createNewOrganization
    ? []
    : await findExistingUsersByUsername(userNamesToCheck, orgIdBig);

  const existingByEmail = await findExistingUsersByEmail(emailsToCheck);

  const conflictUserNames = new Set(existingByUsername.map((u) => u.userName));
  const conflictEmails = new Set(existingByEmail.map((u) => u.email));

  const conflicts = valid
    .filter((r) => conflictUserNames.has(r.userName) || conflictEmails.has(r.email))
    .map((r) => ({
      userName: r.userName,
      email: r.email,
      reason: conflictUserNames.has(r.userName) ? "userName ya existe" : "email ya existe",
    }));

  const conflictUserNameSet = new Set(conflicts.map((c) => c.userName));
  const applyable = valid
    .filter((r) => !conflictUserNameSet.has(r.userName))
    // Importante: NO conservar contraseñas del archivo en memoria.
    .map(({ password: _ignored, ...rest }) => rest as ProcessedImportRow);

  const previewToken = generatePreviewToken();
  previewCache.set(previewToken, {
    rows: applyable,
    societies,
    departments,
    organizationId: orgIdBig,
    actingUserId: actingUserIdBig,
    orgRoles,
    validRoleNames,
    expiresAt: Date.now() + PREVIEW_TTL_MS,
    createNewOrganization,
    newOrgSpec: createNewOrganization ? organizationSpec : undefined,
  });

  // GC oportunista de tokens vencidos.
  for (const [token, entry] of previewCache.entries()) {
    if (entry.expiresAt < Date.now()) previewCache.delete(token);
  }

  const roleNameToId = new Map<string, number>(
    orgRoles.map((r) => [r.roleName.toLowerCase(), r.roleId]),
  );

  const permByRoleId = new Map<number, string[]>();
  await Promise.all(
    orgRoles.map(async (r) => {
      if (r.roleId < 0) {
        const codes: string[] = getDefaultRolePreviewPermissionCodes(r.roleName);
        permByRoleId.set(r.roleId, codes);
        return;
      }
      const codes: string[] = await loadEffectivePermissionsForRole(r.roleId);
      permByRoleId.set(r.roleId, codes);
    }),
  );

  const rolesCatalog: RoleCatalogEntry[] = orgRoles.map((r) => ({
    roleName: r.roleName,
    effectivePermissions: permByRoleId.get(r.roleId) ?? [],
  }));

  const permissionsCatalog = await buildPermissionsCatalogGrouped();

  const previewSlice = applyable.slice(0, 20);
  const preview = previewSlice.map((row) => buildPreviewRow(row, roleNameToId, permByRoleId));

  const unmappedExternalRoles = [
    ...new Set(
      applyable
        .filter((r) => r.externalRoleLabel && !r.mappedRoleName)
        .map((r) => r.externalRoleLabel as string),
    ),
  ];

  const needsRoleMappingCount = applyable.filter(
    (r) => Boolean(r.externalRoleLabel && !r.mappedRoleName),
  ).length;

  const embeddedRoleMappingsFromFile =
    Object.keys(embeddedRoleMappings).length > 0 ? embeddedRoleMappings : undefined;

  const fileHadAnyPassword = processedRows.some((r) => r.hasFilePassword);

  const organizationFromFile =
    organizationSpec && strategy.label === "JSON"
      ? {
          nombre: organizationSpec.nombre,
          rfc: organizationSpec.rfc,
          razonSocial: organizationSpec.razonSocial,
          timezone: organizationSpec.timezone,
          baseCurrency: organizationSpec.baseCurrency,
        }
      : undefined;

  return {
    previewToken,
    strategy: strategy.label === "CSV" ? "CSV" : "JSON",
    totalRows: rows.length,
    validRows: applyable.length,
    invalidRows: errors.length,
    conflictRows: conflicts.length,
    needsRoleMappingCount,
    unmappedExternalRoles,
    embeddedRoleMappingsFromFile,
    fileHadPasswords: fileHadAnyPassword,
    preview,
    applyableUsernames: applyable.map((r) => r.userName),
    permissionsCatalog,
    rolesCatalog,
    errors,
    conflicts,
    societies,
    departments,
    organizationFromFile,
    newOrganizationApplyAvailable:
      strategy.label === "JSON" &&
      Boolean(organizationSpec?.nombre?.trim()) &&
      actorHasOrganizationCreate,
    previewCreateNewOrganization: createNewOrganization,
  };
}

/**
 * Fase 2: persiste usuarios del preview en la BD.
 */
export async function applyImport(
  previewToken: string,
  organizationId: bigint | number | string,
  actingUserId: bigint | number | string,
  roleMappings: Record<string, string> = {},
  permissionExtrasByUser: Record<string, string[]> = {},
  passwordOptions: { globalPassword?: string; perUser?: Record<string, string> } = {},
  roleOverridesByUser: Record<string, string> = {},
  applyOptions: { createNewOrganization?: boolean } = {},
  customImportRolesByUser: Record<string, CustomImportRoleSpec> = {},
): Promise<ApplyImportResult> {
  const entry = previewCache.get(previewToken);
  if (!entry) {
    throw new Error("Token de previsualización inválido o expirado. Vuelve a subir el archivo.");
  }
  if (entry.expiresAt < Date.now()) {
    previewCache.delete(previewToken);
    throw new Error("Token de previsualización expirado. Vuelve a subir el archivo.");
  }
  if (!sameBigInt(entry.organizationId, organizationId)) {
    throw new Error("El token no corresponde a esta organización.");
  }
  if (
    actingUserId === undefined ||
    actingUserId === null ||
    !sameBigInt(entry.actingUserId, actingUserId)
  ) {
    throw new Error("El token fue emitido para otro usuario; vuelve a subir el archivo.");
  }

  const applyCreateNew = Boolean(applyOptions?.createNewOrganization);
  if (applyCreateNew !== Boolean(entry.createNewOrganization)) {
    throw new Error(
      "La opción «crear organización nueva» no coincide con la vista previa. Vuelve a generar la vista previa.",
    );
  }

  // Consumir el token solo después de validar el contexto.
  previewCache.delete(previewToken);

  const perUserPwd =
    passwordOptions.perUser &&
    typeof passwordOptions.perUser === "object" &&
    !Array.isArray(passwordOptions.perUser)
      ? passwordOptions.perUser
      : {};
  const globalPwdTrim =
    typeof passwordOptions.globalPassword === "string" ? passwordOptions.globalPassword.trim() : "";

  validatePasswordApplyOptions(perUserPwd, globalPwdTrim);

  let orgIdBig = BigInt(organizationId);
  let roleMap: Map<string, number>;
  let validRoleNames: string[] = entry.validRoleNames;

  if (entry.createNewOrganization) {
    if (!entry.newOrgSpec) {
      throw new Error("Vista previa incompleta: falta la definición de la organización nueva.");
    }
    const { organization } = await createClientOrganizationOnly(entry.newOrgSpec);
    orgIdBig = BigInt(organization.id);
    const orgRolesFresh = await listRolesByOrg(orgIdBig);
    roleMap = new Map(orgRolesFresh.map((r) => [r.roleName.toLowerCase(), r.roleId]));
    validRoleNames = orgRolesFresh.map((r) => r.roleName);
  } else {
    roleMap = new Map(entry.orgRoles.map((r) => [r.roleName.toLowerCase(), r.roleId]));
  }

  const overridesByUser =
    roleOverridesByUser &&
    typeof roleOverridesByUser === "object" &&
    !Array.isArray(roleOverridesByUser)
      ? roleOverridesByUser
      : {};

  const customCreatedRoleNames = await createCustomImportRolesInApply({
    organizationId: orgIdBig,
    roleMap,
    validRoleNames,
    rows: entry.rows,
    customImportRolesByUser,
  });

  const resolvedOverrides: Record<string, string> = { ...overridesByUser, ...customCreatedRoleNames };

  // Validamos que todos los overrides apunten a roles existentes en la org.
  for (const [uname, overrideName] of Object.entries(resolvedOverrides)) {
    const candidate = String(overrideName ?? "").trim();
    if (!candidate) continue;
    const canonical = resolveManualRoleMapping(candidate, validRoleNames);
    if (!canonical) {
      throw new Error(`El rol "${candidate}" para «${uname}» no existe en esta organización.`);
    }
  }

  // Solo exigimos mapping de etiquetas externas para usuarios que NO tengan override.
  const needsMappingRows = entry.rows.filter(
    (r) =>
      r.externalRoleLabel &&
      !r.mappedRoleName &&
      !String(resolvedOverrides[r.userName] ?? "").trim(),
  );
  for (const row of needsMappingRows) {
    const picked = pickRoleMapping(row.externalRoleLabel, roleMappings);
    if (!picked || !picked.trim()) {
      throw new Error(
        `Falta asignar un rol de esta organización para la etiqueta externa "${row.externalRoleLabel}". ` +
          `Incluye roleMappings en el cuerpo (ej. { "${row.externalRoleLabel}": "Solicitante" }) ` +
          `o un rol por usuario en roleOverrides.`,
      );
    }
  }

  const createdSocieties: Array<{ societyId: bigint }> = [];
  const catalogErrors: string[] = [];
  if (entry.societies && entry.societies.length > 0) {
    for (const soc of entry.societies) {
      try {
        const dbSoc = await upsertAccountingSociety({
          organizationId: orgIdBig,
          code: soc.code,
          name: soc.name,
        });
        createdSocieties.push(dbSoc);
      } catch (e) {
        catalogErrors.push(`Sociedad "${soc.code}": ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (catalogErrors.length > 0) {
      throw new Error(`No se pudo importar el catálogo de sociedades: ${catalogErrors.join("; ")}`);
    }
  }

  const defaultSocietyId = createdSocieties.length === 1 ? createdSocieties[0].societyId : undefined;

  const createdDepartments: Array<{
    departmentId: number;
    departmentName: string;
    costsCenter: string | null;
  }> = [];
  if (entry.departments && entry.departments.length > 0) {
    for (const dep of entry.departments) {
      try {
        const dbDep = await upsertDepartmentForImport({
          organizationId: orgIdBig,
          departmentName: dep.departmentName,
          costsCenter: dep.costsCenter,
          societyId: defaultSocietyId,
        });
        createdDepartments.push(dbDep);
      } catch (e) {
        catalogErrors.push(
          `Departamento "${dep.departmentName}": ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
    if (catalogErrors.length > 0) {
      throw new Error(
        `No se pudo importar el catálogo de departamentos/CeCo: ${catalogErrors.join("; ")}`,
      );
    }
  }

  const departmentByCeco = new Map<string, number>(
    createdDepartments.filter((d) => d.costsCenter).map((d) => [d.costsCenter as string, d.departmentId]),
  );
  const departmentByName = new Map<string, number>(
    createdDepartments.map((d) => [d.departmentName.toLowerCase(), d.departmentId]),
  );

  const created: CreatedImportUser[] = [];
  const managerLinks: Array<{ userId: number; managerNoEmpleado: string }> = [];
  let skipped = 0;
  const failures: ApplyImportFailure[] = [];

  for (const row of entry.rows) {
    /**
     * Prioridad para el rol final:
     *   1. roleOverridesByUser[userName]  — elección explícita del admin en la UI.
     *   2. row.mappedRoleName             — resuelto en el preview (archivo/aliases).
     *   3. roleMappings[externalLabel]    — mapping manual de etiquetas externas.
     */
    let canonical: string | null = null;
    const overrideRaw = String(resolvedOverrides[row.userName] ?? "").trim();
    if (overrideRaw) {
      canonical = resolveManualRoleMapping(overrideRaw, validRoleNames);
    }
    if (!canonical) canonical = row.mappedRoleName ?? null;
    if (!canonical && row.externalRoleLabel) {
      const picked = pickRoleMapping(row.externalRoleLabel, roleMappings);
      canonical = resolveManualRoleMapping(picked, validRoleNames);
      if (!canonical) {
        throw new Error(
          `El rol "${picked}" no existe en esta organización (etiqueta externa "${row.externalRoleLabel}").`,
        );
      }
    }
    if (!canonical) {
      skipped++;
      continue;
    }

    const roleId = roleMap.get(canonical.toLowerCase());
    if (!roleId) {
      skipped++;
      continue;
    }

    const plain = resolvePlainPassword(row.userName, perUserPwd, globalPwdTrim);
    if (!plain) {
      throw new Error(
        `No hay contraseña para «${row.userName}». Define una contraseña global o por usuario.`,
      );
    }
    if (!isValidImportPassword(plain)) {
      throw new Error(`Contraseña inválida para ${row.userName}.`);
    }

    const passwordHash = await bcrypt.hash(plain, SALT_ROUNDS);

    let departmentId: number | undefined = undefined;
    if (row.department) {
      departmentId =
        departmentByCeco.get(row.department) || departmentByName.get(row.department.toLowerCase());
    }

    let user: CreatedImportUser;
    try {
      user = await createImportedUser({
        organizationId: orgIdBig,
        roleId,
        userName: row.userName,
        password: passwordHash,
        email: row.email,
        workstation: row.department ?? "importado",
        departmentId,
        active: true,
      });
      await ensureTenantApplicantUserPermissions(orgIdBig, user.userId);
    } catch (e) {
      if (isPrismaUniqueError(e)) {
        const target = Array.isArray(e.meta?.target)
          ? e.meta.target.join(",").toLowerCase()
          : String(e.meta?.target ?? "").toLowerCase();
        const field = target.includes("email") ? "email" : "userName";
        failures.push({
          userName: row.userName,
          reason: `${field} ya existe (otro usuario lo tomó después del preview).`,
        });
        skipped++;
        continue;
      }
      throw e;
    }

    // Si el archivo trae no_empleado (layout SAP), sincronizamos catálogo Empleado.
    if (row.noEmpleado) {
      const noEmpleado = String(row.noEmpleado).slice(0, 10);
      const proveedor = String(row.sapProveedor || fallbackProveedorFromUserId(user.userId)).slice(0, 11);
      const ceco = String(row.sapCeco || row.department || "000").slice(0, 10);
      const status = String(row.sapStatus || "A").toUpperCase() === "I" ? "I" : "A";
      const nombre = buildEmpleadoNombre(row).slice(0, 100);
      const actor = `import_${String(actingUserId)}`.slice(0, 30);

      await upsertEmpleadoForImport({
        where: { organizationId_noEmpleado: { organizationId: orgIdBig, noEmpleado } },
        create: {
          organizationId: orgIdBig,
          noEmpleado,
          nombre,
          email: row.email ? String(row.email).slice(0, 100) : null,
          jefeInmediato: row.managerNoEmpleado ? String(row.managerNoEmpleado).slice(0, 10) : null,
          proveedor,
          ceco,
          departmentId,
          societyId: defaultSocietyId,
          status,
          fechaAlta: new Date(),
          usuarioUltimaModificacion: actor,
        },
        update: {
          nombre,
          email: row.email ? String(row.email).slice(0, 100) : null,
          jefeInmediato: row.managerNoEmpleado ? String(row.managerNoEmpleado).slice(0, 10) : null,
          proveedor,
          ceco,
          departmentId,
          societyId: defaultSocietyId,
          status,
          usuarioUltimaModificacion: actor,
        },
      });

      await updateUserPartial(user.userId, { noEmpleado });

      if (row.managerNoEmpleado) {
        managerLinks.push({
          userId: user.userId,
          managerNoEmpleado: String(row.managerNoEmpleado).slice(0, 10),
        });
      }
      user.noEmpleado = noEmpleado;
    }

    created.push(user);

    const extraCodes = permissionExtrasByUser[row.userName];
    if (Array.isArray(extraCodes) && extraCodes.length > 0) {
      const roleEffective: string[] = await loadEffectivePermissionsForRole(roleId);
      const roleSet = new Set(roleEffective);
      const toAdd = [...new Set(extraCodes.map(String).map((c) => c.trim()).filter(Boolean))].filter(
        (c) => !roleSet.has(c),
      );
      if (toAdd.length > 0) {
        const permRows = await findActivePermissionsByCodes(toAdd);
        const found = new Set(permRows.map((p) => p.code));
        const missing = toAdd.filter((c) => !found.has(c));
        if (missing.length > 0) {
          throw new Error(`Permisos no válidos o inactivos para ${row.userName}: ${missing.join(", ")}`);
        }
        await grantUserPermissions(
          permRows.map((p) => ({
            userId: user.userId,
            permissionId: p.permissionId,
            organizationId: orgIdBig,
          })),
        );
      }
    }
  }

  // Segunda pasada: resolver managerUserId por no_empleado (adjacency list SAP).
  if (managerLinks.length > 0) {
    const managerNoEmpleadoSet = [...new Set(managerLinks.map((m) => m.managerNoEmpleado))];
    const managerUsers = await findManagersByNoEmpleado(orgIdBig, managerNoEmpleadoSet);
    const managerByNoEmpleado = new Map(
      managerUsers
        .filter((u) => u.noEmpleado != null)
        .map((u) => [String(u.noEmpleado), Number(u.userId)]),
    );

    for (const link of managerLinks) {
      const managerUserId = managerByNoEmpleado.get(link.managerNoEmpleado);
      if (!managerUserId || Number(managerUserId) === Number(link.userId)) continue;
      await updateUserPartial(link.userId, { managerUserId: Number(managerUserId) });
    }
  }

  /** Jerarquía por userName (CSV/JSON estándar con columna manager / managerUserName). */
  const stdManagerLinks = entry.rows
    .map((r) => ({
      subUserName: String(r.userName ?? "").trim(),
      mgrUserName: String(r.managerUserName ?? "").trim(),
    }))
    .filter((l) => l.subUserName && l.mgrUserName);

  if (stdManagerLinks.length > 0) {
    const allNames = [...new Set(stdManagerLinks.flatMap((l) => [l.subUserName, l.mgrUserName]))];
    const usersInOrg = await findUsersByUsernameInOrg(orgIdBig, allNames);
    const byLower = new Map(usersInOrg.map((u) => [u.userName.toLowerCase(), u.userId]));
    for (const { subUserName, mgrUserName } of stdManagerLinks) {
      const sid = byLower.get(subUserName.toLowerCase());
      const mid = byLower.get(mgrUserName.toLowerCase());
      if (!sid || !mid || Number(sid) === Number(mid)) continue;
      await updateUserPartial(sid, { managerUserId: Number(mid) });
    }
  }

  let bootstrapAdmin: { userName: string; email: string; temporaryPassword: string } | undefined =
    undefined;
  if (entry.createNewOrganization && created.length > 0) {
    const adminRole = await findAdminRoleInOrg(orgIdBig);
    if (adminRole) {
      const hasAdmin = await findExistingAdminUser(orgIdBig, adminRole.roleId);
      if (!hasAdmin) {
        const plain = generateBootstrapAdminPassword();
        const passwordHash = await bcrypt.hash(plain, SALT_ROUNDS);
        const orgNameSafe = String(entry.newOrgSpec?.nombre ?? "empresa")
          .replace(/\s+/g, "")
          .toLowerCase();
        const adminUserName = `admin@${orgNameSafe}.com`;
        const newAdmin = await createImportedUser({
          organizationId: orgIdBig,
          roleId: adminRole.roleId,
          userName: adminUserName,
          email: adminUserName,
          password: passwordHash,
          workstation: "Sistemas",
          active: true,
        });
        created.push(newAdmin);
        bootstrapAdmin = {
          userName: adminUserName,
          email: adminUserName,
          temporaryPassword: plain,
        };
      }
    }
  }

  const createdOrganization = entry.createNewOrganization
    ? { id: orgIdBig.toString(), nombre: String(entry.newOrgSpec?.nombre ?? "") }
    : undefined;

  return {
    created: created.length,
    skipped,
    createdUsers: created,
    appliedBy: actingUserId,
    failures,
    createdOrganization,
    ...(bootstrapAdmin
      ? {
          bootstrapAdmin,
          bootstrapAdminNotice:
            "Contraseña temporal del administrador inicial. Guárdala ahora; no se volverá a mostrar.",
        }
      : {}),
  };
}
