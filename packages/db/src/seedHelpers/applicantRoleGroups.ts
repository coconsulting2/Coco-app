/**
 * @file src/seedHelpers/applicantRoleGroups.ts
 * @description Grupos de permiso que todo rol operativo debería enlazar para
 * coherencia con BD/UI (además de la unión implícita en
 * `loadEffectivePermissions`; ver CocoAPI_flujos §7.15).
 * Llamar desde futuras rutas `POST /admin/roles` o clonación de rol.
 */
import type { PrismaClient, Prisma } from "@prisma/client";

/** Client base o transacción interactiva — ambos exponen los delegates usados aquí. */
type PrismaOrTx = PrismaClient | Prisma.TransactionClient;

export const APPLICANT_DEFAULT_GROUP_NAMES: ReadonlyArray<string> = Object.freeze([
  "BaseColaborador",
  "TravelRequestAuthor",
]);

/**
 * Idempotente: enlaza `BaseColaborador` y `TravelRequestAuthor` de la org al rol si existen.
 */
export async function ensureApplicantGroupsForRole(
  prismaOrTx: PrismaOrTx,
  organizationId: bigint | number | string,
  roleId: number,
): Promise<{ linkedGroupIds: number[] }> {
  const orgIdBig = BigInt(organizationId);
  const groups = await prismaOrTx.permissionGroup.findMany({
    where: {
      organizationId: orgIdBig,
      groupName: { in: [...APPLICANT_DEFAULT_GROUP_NAMES] },
      active: true,
    },
    select: { groupId: true },
  });
  const data = groups.map((g) => ({ roleId, groupId: g.groupId }));
  if (data.length > 0) {
    await prismaOrTx.rolePermissionGroup.createMany({ data, skipDuplicates: true });
  }
  return { linkedGroupIds: groups.map((g) => g.groupId) };
}
