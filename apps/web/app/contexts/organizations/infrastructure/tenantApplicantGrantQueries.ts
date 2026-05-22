/**
 * @module tenantApplicantGrantQueries
 * @description Queries Prisma para grants implícitos del rol "Solicitante".
 */
import prisma from "~/platform/db/prisma.server.js";

export async function findActivePermissionsByCodes(
  codes: string[],
): Promise<Array<{ permissionId: number }>> {
  return prisma.permission.findMany({
    where: { code: { in: codes }, active: true },
    select: { permissionId: true },
  });
}

export async function grantUserPermissionsBulk(
  rows: Array<{ userId: number; permissionId: number; organizationId: bigint }>,
): Promise<void> {
  if (!Array.isArray(rows) || rows.length === 0) return;
  await prisma.userPermission.createMany({
    data: rows,
    skipDuplicates: true,
  });
}
