/**
 * @module organizationService
 * @description Use-cases de gestión de organizaciones (tenants). Solo Ditta
 * (super-admin ROOT) puede crear/listar todas; cada org cliente solo ve la
 * propia. Refactor LANE-ORG: sin Prisma directo y sin supresores de tipos. La
 * persistencia y el bootstrap viven detrás de los puertos
 * `OrganizationRepository` / `OrganizationProvisioning` (DI). El `withRls`
 * interno preserva la paridad con el legacy Express (cross-org bypass) para
 * los consumidores que no envuelven RLS ellos mismos (p. ej. onboarding).
 */
import { withRls } from "~/platform/db/rls.server.js";
import type {
  OrganizationRecord,
  OrganizationRepository,
} from "~/contexts/organizations/domain/ports/OrganizationRepository.js";
import type { OrganizationProvisioning } from "~/contexts/organizations/domain/ports/OrganizationProvisioning.js";
import { PrismaOrganizationRepository } from "~/contexts/organizations/infrastructure/PrismaOrganizationRepository.js";
import { CocoDbOrganizationProvisioning } from "~/contexts/organizations/infrastructure/CocoDbOrganizationProvisioning.js";

export type OrganizationServiceDeps = {
  repo: OrganizationRepository;
  provisioning: OrganizationProvisioning;
};

let cachedDeps: OrganizationServiceDeps | null = null;
function defaultDeps(): OrganizationServiceDeps {
  if (!cachedDeps) {
    cachedDeps = {
      repo: new PrismaOrganizationRepository(),
      provisioning: new CocoDbOrganizationProvisioning(),
    };
  }
  return cachedDeps;
}

export type SerializedOrganization = {
  id: string;
  nombre: string;
  razonSocial: string | null;
  rfc: string | null;
  logoUrl: string | null;
  timezone: string;
  baseCurrency: string;
  kind: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export class OrganizationValidationError extends Error {
  readonly code = "ORGANIZATIONVALIDATION";
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = "OrganizationValidationError";
  }
}

function serializeOrganization(o: OrganizationRecord): SerializedOrganization {
  return {
    id: typeof o.id === "bigint" ? o.id.toString() : String(o.id),
    nombre: o.nombre,
    razonSocial: o.razonSocial,
    rfc: o.rfc,
    logoUrl: o.logoUrl,
    timezone: o.timezone,
    baseCurrency: o.baseCurrency,
    kind: o.kind,
    status: o.status,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

const RFC_RE = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i;

export type CreateOrganizationInput = {
  nombre: string;
  rfc?: string | null;
  razonSocial?: string | null;
  timezone?: string;
  baseCurrency?: string;
  adminEmail: string;
  adminNombre?: string;
  adminPassword: string;
};

export async function createOrganization(
  input: CreateOrganizationInput,
  deps: OrganizationServiceDeps = defaultDeps(),
): Promise<{ organization: SerializedOrganization }> {
  const {
    nombre,
    rfc = null,
    razonSocial = null,
    timezone = "America/Mexico_City",
    baseCurrency = "MXN",
    adminEmail,
    adminPassword,
  } = input;

  if (!nombre?.trim()) {
    throw new OrganizationValidationError("El nombre de la organización es obligatorio");
  }
  if (!adminEmail?.trim() || !adminPassword?.trim()) {
    throw new OrganizationValidationError("Se requiere email y contraseña del admin inicial");
  }
  if (rfc && !RFC_RE.test(rfc)) {
    throw new OrganizationValidationError("RFC inválido (formato SAT)");
  }

  return withRls(1n, { bypass: true }, async () => {
    const org = await deps.repo.create({
      nombre: nombre.trim(),
      rfc: rfc ?? null,
      razonSocial: razonSocial ?? null,
      timezone,
      baseCurrency,
      kind: "CLIENT",
      status: "CONFIGURING",
    });

    await deps.provisioning.bootstrapCatalogs(org.id, {
      includeDittaSuperAdmin: false,
    });

    const userName = adminEmail
      .split("@")[0]!
      .replace(/[^a-z0-9_]/gi, "_")
      .slice(0, 60);
    await deps.provisioning.ensureAdmin(org.id, {
      userName,
      email: adminEmail,
      password: adminPassword,
      roleName: "Administrador",
    });

    return { organization: serializeOrganization(org) };
  });
}

export type CreateClientOrgOnlyInput = {
  nombre: string;
  rfc?: string | null;
  razonSocial?: string | null;
  timezone?: string;
  baseCurrency?: string;
};

export async function createClientOrganizationOnly(
  input: CreateClientOrgOnlyInput,
  deps: OrganizationServiceDeps = defaultDeps(),
): Promise<{ organization: SerializedOrganization }> {
  const {
    nombre,
    rfc = null,
    razonSocial = null,
    timezone = "America/Mexico_City",
    baseCurrency = "MXN",
  } = input;

  if (!nombre?.trim()) {
    throw new OrganizationValidationError("El nombre de la organización es obligatorio");
  }
  if (rfc && !RFC_RE.test(rfc)) {
    throw new OrganizationValidationError("RFC inválido (formato SAT)");
  }

  return withRls(1n, { bypass: true }, async () => {
    const org = await deps.repo.create({
      nombre: nombre.trim(),
      rfc: rfc ?? null,
      razonSocial: razonSocial ?? null,
      timezone,
      baseCurrency,
      kind: "CLIENT",
      status: "CONFIGURING",
    });
    await deps.provisioning.bootstrapCatalogs(org.id, {
      includeDittaSuperAdmin: false,
    });
    return { organization: serializeOrganization(org) };
  });
}

export type ListOrganizationsOpts = {
  kind?: string;
  status?: string;
  page?: number;
  pageSize?: number;
};

export async function listOrganizations(
  opts: ListOrganizationsOpts = {},
  deps: OrganizationServiceDeps = defaultDeps(),
): Promise<{
  data: SerializedOrganization[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const { kind, status, page = 1, pageSize = 25 } = opts;
  const where: { kind?: string; status?: string } = {};
  if (kind) where.kind = kind;
  if (status) where.status = status;

  return withRls(1n, { bypass: true }, async () => {
    const { rows, total } = await deps.repo.list(where, { page, pageSize });
    return {
      data: rows.map(serializeOrganization),
      total,
      page,
      pageSize,
    };
  });
}

export async function getOrganization(
  id: bigint | number | string,
  { bypass = false }: { bypass?: boolean } = {},
  deps: OrganizationServiceDeps = defaultDeps(),
): Promise<SerializedOrganization | null> {
  const organizationId = typeof id === "bigint" ? id : BigInt(id);
  return withRls(organizationId, { bypass }, async () => {
    const org = await deps.repo.findById(organizationId);
    return org ? serializeOrganization(org) : null;
  });
}

export async function getOrganizationMe(
  organizationId: bigint | number | string,
  deps: OrganizationServiceDeps = defaultDeps(),
): Promise<SerializedOrganization | null> {
  return getOrganization(organizationId, { bypass: false }, deps);
}

export type UpdateOrganizationPatch = Partial<{
  nombre: string;
  logoUrl: string | null;
  timezone: string;
  baseCurrency: string;
  razonSocial: string | null;
  rfc: string | null;
}>;

const UPDATE_ALLOWED_KEYS = [
  "nombre",
  "logoUrl",
  "timezone",
  "baseCurrency",
  "razonSocial",
  "rfc",
] as const;

export async function updateOrganization(
  id: bigint | number | string,
  patch: UpdateOrganizationPatch,
  { bypass = false }: { bypass?: boolean } = {},
  deps: OrganizationServiceDeps = defaultDeps(),
): Promise<SerializedOrganization> {
  const organizationId = typeof id === "bigint" ? id : BigInt(id);
  const data: UpdateOrganizationPatch = {};
  for (const k of UPDATE_ALLOWED_KEYS) {
    if (patch[k] !== undefined) {
      (data as Record<string, unknown>)[k] = patch[k];
    }
  }
  if (Object.keys(data).length === 0) {
    throw new OrganizationValidationError("Nada que actualizar");
  }
  return withRls(organizationId, { bypass }, async () => {
    const updated = await deps.repo.update(organizationId, data);
    return serializeOrganization(updated);
  });
}

export async function activateOrganization(
  id: bigint | number | string,
  deps: OrganizationServiceDeps = defaultDeps(),
): Promise<SerializedOrganization> {
  const organizationId = typeof id === "bigint" ? id : BigInt(id);
  return withRls(1n, { bypass: true }, async () => {
    const updated = await deps.repo.update(organizationId, { status: "ACTIVE" });
    return serializeOrganization(updated);
  });
}

export async function suspendOrganization(
  id: bigint | number | string,
  deps: OrganizationServiceDeps = defaultDeps(),
): Promise<SerializedOrganization> {
  const organizationId = typeof id === "bigint" ? id : BigInt(id);
  if (organizationId === 1n) {
    throw new OrganizationValidationError("La organización ROOT no puede ser suspendida");
  }
  return withRls(1n, { bypass: true }, async () => {
    const updated = await deps.repo.update(organizationId, { status: "SUSPENDED" });
    return serializeOrganization(updated);
  });
}
