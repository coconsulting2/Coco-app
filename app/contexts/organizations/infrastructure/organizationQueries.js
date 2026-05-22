/**
 * @module organizationQueries
 * @description Queries Prisma para Organization CRUD. Extracción Fase 6
 * desde organizationService.js. Todas las queries van envueltas en `withRls`
 * desde el service (con bypass=true para Ditta cross-tenant).
 */
import prisma from "~/platform/db/prisma.server.js";

/**
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function createOrganizationRow(data) {
  return prisma.organization.create({ data });
}

/**
 * @param {object} where
 * @param {{ page?: number; pageSize?: number; orderBy?: object[] }} opts
 * @returns {Promise<{ rows: object[]; total: number }>}
 */
export async function listOrganizationsPaginated(where, opts) {
  const { page = 1, pageSize = 25, orderBy = [{ kind: "asc" }, { nombre: "asc" }] } = opts;
  const [rows, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.organization.count({ where }),
  ]);
  return { rows, total };
}

/**
 * @param {bigint} id
 * @returns {Promise<object | null>}
 */
export async function findOrganizationById(id) {
  return prisma.organization.findUnique({ where: { id } });
}

/**
 * @param {bigint} id
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function updateOrganizationRow(id, data) {
  return prisma.organization.update({ where: { id }, data });
}

/**
 * Acceso al cliente Prisma para uso desde seedHelpers (bootstrap catalogs).
 * Estos helpers reciben el cliente como primer argumento.
 */
export { prisma as prismaClient };
