/**
 * @module viaticasPolicyQueries
 * @description Adapter Prisma del puerto ViaticosUserQueriesPort. Lectura del
 * organizationId del usuario (extracción de prisma fuera de application/).
 */
import prisma from "~/platform/db/prisma.server.js";
import type { ViaticosUserQueriesPort } from "~/contexts/policies/domain/ports/ViaticosPolicyPort";

export async function getUserOrganizationId(userId: number): Promise<bigint | null> {
  const user = await prisma.user.findUnique({
    where: { userId: Number(userId) },
    select: { organizationId: true },
  });
  return user?.organizationId ?? null;
}

/** Adapter pre-wireado del puerto ViaticosUserQueriesPort. */
export const prismaViaticosUserQueries: ViaticosUserQueriesPort = {
  getUserOrganizationId,
};
