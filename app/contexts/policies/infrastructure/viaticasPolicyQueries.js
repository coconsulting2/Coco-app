/**
 * @module viaticasPolicyQueries
 * @description Queries Prisma usadas por viaticasPolicyService (extracción
 * Fase 6 hardening — saca prisma de application/).
 */
import prisma from "~/platform/db/prisma.server.js";

/**
 * Devuelve organizationId del usuario o null si no existe.
 * @param {number} userId
 * @returns {Promise<bigint | null>}
 */
export async function getUserOrganizationId(userId) {
  const user = await prisma.user.findUnique({
    where: { userId: Number(userId) },
    select: { organizationId: true },
  });
  return user?.organizationId ?? null;
}
