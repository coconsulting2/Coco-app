// @ts-nocheck — bulk-converted legacy; typed properly is M9 follow-up
/**
 * @module policyAlertQueries
 * @description Queries Prisma usadas por policyAlertService.
 */
import prisma from "~/platform/db/prisma.server.js";

/**
 * Lookup completo de Request con joins necesarios para evaluación de política
 * pre-envío (snapshot + user.organizationId + routes con countries).
 *
 * @param {number} requestId
 * @returns {Promise<object | null>}
 */
export async function findRequestForPolicyPreview(requestId) {
  return prisma.request.findUnique({
    where: { requestId: Number(requestId) },
    select: {
      requestId: true,
      policyEvaluationSnapshot: true,
      user: { select: { organizationId: true } },
      routeRequests: { include: { route: true } },
    },
  });
}

/**
 * Lista las políticas activas de una organización con sus topes.
 *
 * @param {bigint | number} organizationId
 * @returns {Promise<object[]>}
 */
export async function listActivePoliciesForOrg(organizationId) {
  return prisma.travelPolicy.findMany({
    where: { organizationId, active: true },
    include: { expenseCaps: true },
  });
}
