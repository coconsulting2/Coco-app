/**
 * @module organizationService
 * @description Gestión de organizaciones (tenants). Solo Ditta puede
 * crear/listar todas. Cada org cliente solo ve la propia.
 *
 * Endpoints expuestos vía controllers/organizationController.js:
 *   POST   /api/organizations                    organization:create
 *   GET    /api/organizations                    organization:list_all
 *   GET    /api/organizations/me                 autenticado
 *   GET    /api/organizations/:id                organization:read
 *   PATCH  /api/organizations/:id                organization:update
 *   POST   /api/organizations/:id/activate       organization:activate
 *   POST   /api/organizations/:id/suspend        organization:suspend
 *
 * Refactor Fase 6: prisma extraído a organizationQueries.js. seedHelpers
 * (`bootstrapOrganizationCatalogs`, `ensureOrganizationAdmin`) reciben el
 * cliente Prisma desde infrastructure.
 */
import { withRls } from "~/platform/db/rls.server.js";
import {
  bootstrapOrganizationCatalogs,
  ensureOrganizationAdmin,
} from "~/prisma/seedHelpers/bootstrapOrganization.js";
import {
  createOrganizationRow,
  listOrganizationsPaginated,
  findOrganizationById,
  updateOrganizationRow,
  prismaClient,
} from "~/contexts/organizations/infrastructure/organizationQueries.js";

/**
 * Crea una nueva organización CLIENT con su admin inicial. Solo super-admin Ditta.
 */
export async function createOrganization(input) {
  const {
    nombre,
    rfc = null,
    razonSocial = null,
    timezone = "America/Mexico_City",
    baseCurrency = "MXN",
    adminEmail,
    adminNombre,
    adminPassword,
  } = input;

  if (!nombre?.trim()) {
    const err = new Error("El nombre de la organización es obligatorio");
    err.status = 400;
    throw err;
  }
  if (!adminEmail?.trim() || !adminPassword?.trim()) {
    const err = new Error("Se requiere email y contraseña del admin inicial");
    err.status = 400;
    throw err;
  }
  if (rfc && !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i.test(rfc)) {
    const err = new Error("RFC inválido (formato SAT)");
    err.status = 400;
    throw err;
  }

  return withRls(1n, { bypass: true }, async () => {
    const org = await createOrganizationRow({
      nombre,
      rfc: rfc ?? null,
      razonSocial: razonSocial ?? null,
      timezone,
      baseCurrency,
      kind: "CLIENT",
      status: "CONFIGURING",
    });

    await bootstrapOrganizationCatalogs(prismaClient, org.id, { includeDittaSuperAdmin: false });

    const userName = adminEmail.split("@")[0].replace(/[^a-z0-9_]/gi, "_").slice(0, 60);
    await ensureOrganizationAdmin(prismaClient, org.id, {
      userName,
      email: adminEmail,
      password: adminPassword,
      roleName: "Administrador",
    });

    return { organization: serializeOrganization(org) };
  });
}

/**
 * Crea una org CLIENT en CONFIGURING + catálogos bootstrap, sin admin inicial.
 */
export async function createClientOrganizationOnly(input) {
  const {
    nombre,
    rfc = null,
    razonSocial = null,
    timezone = "America/Mexico_City",
    baseCurrency = "MXN",
  } = input;

  if (!nombre?.trim()) {
    const err = new Error("El nombre de la organización es obligatorio");
    err.status = 400;
    throw err;
  }
  if (rfc && !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i.test(rfc)) {
    const err = new Error("RFC inválido (formato SAT)");
    err.status = 400;
    throw err;
  }

  return withRls(1n, { bypass: true }, async () => {
    const org = await createOrganizationRow({
      nombre: nombre.trim(),
      rfc: rfc ?? null,
      razonSocial: razonSocial ?? null,
      timezone,
      baseCurrency,
      kind: "CLIENT",
      status: "CONFIGURING",
    });
    await bootstrapOrganizationCatalogs(prismaClient, org.id, { includeDittaSuperAdmin: false });
    return { organization: serializeOrganization(org) };
  });
}

/**
 * Lista todas las orgs (solo Ditta).
 */
export async function listOrganizations(opts = {}) {
  const { kind, status, page = 1, pageSize = 25 } = opts;
  const where = {};
  if (kind) where.kind = kind;
  if (status) where.status = status;

  return withRls(1n, { bypass: true }, async () => {
    const { rows, total } = await listOrganizationsPaginated(where, { page, pageSize });
    return {
      data: rows.map(serializeOrganization),
      total,
      page,
      pageSize,
    };
  });
}

export async function getOrganization(id, { bypass = false } = {}) {
  const organizationId = BigInt(id);
  return withRls(organizationId, { bypass }, async () => {
    const org = await findOrganizationById(organizationId);
    return org ? serializeOrganization(org) : null;
  });
}

export async function getOrganizationMe(organizationId) {
  return getOrganization(organizationId, { bypass: false });
}

export async function updateOrganization(id, patch, { bypass = false } = {}) {
  const organizationId = BigInt(id);
  const allowed = ["nombre", "logoUrl", "timezone", "baseCurrency", "razonSocial", "rfc"];
  const data = {};
  for (const k of allowed) {
    if (patch[k] !== undefined) data[k] = patch[k];
  }
  if (Object.keys(data).length === 0) {
    const err = new Error("Nada que actualizar");
    err.status = 400;
    throw err;
  }
  return withRls(organizationId, { bypass }, async () => {
    const updated = await updateOrganizationRow(organizationId, data);
    return serializeOrganization(updated);
  });
}

export async function activateOrganization(id) {
  const organizationId = BigInt(id);
  return withRls(1n, { bypass: true }, async () => {
    const updated = await updateOrganizationRow(organizationId, { status: "ACTIVE" });
    return serializeOrganization(updated);
  });
}

export async function suspendOrganization(id) {
  const organizationId = BigInt(id);
  if (organizationId === 1n) {
    const err = new Error("La organización ROOT no puede ser suspendida");
    err.status = 400;
    throw err;
  }
  return withRls(1n, { bypass: true }, async () => {
    const updated = await updateOrganizationRow(organizationId, { status: "SUSPENDED" });
    return serializeOrganization(updated);
  });
}

function serializeOrganization(o) {
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
