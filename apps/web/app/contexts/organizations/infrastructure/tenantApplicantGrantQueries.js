/**
 * @module tenantApplicantGrantQueries
 * @description Queries Prisma para grants implícitos del rol "Solicitante"
 * por tenant. Extracción Fase 6.
 */
import prisma from "~/platform/db/prisma.server.js";

/**
 * @param {string[]} codes
 * @returns {Promise<Array<{ permissionId: number }>>}
 */
export async function findActivePermissionsByCodes(codes) {
  return prisma.permission.findMany({
    where: { code: { in: codes }, active: true },
    select: { permissionId: true },
  });
}

/**
 * @param {Array<{ userId: number; permissionId: number; organizationId: bigint }>} rows
 * @returns {Promise<void>}
 */
export async function grantUserPermissionsBulk(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return;
  await prisma.userPermission.createMany({
    data: rows,
    skipDuplicates: true,
  });
}
