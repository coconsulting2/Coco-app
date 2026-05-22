/**
 * @module requestCommentQueries
 * @description Queries Prisma para comentarios de Request. Extracción Fase 6
 * desde requestCommentService.js (application/).
 *
 * Las mutaciones se envuelven en `withRls(orgId, ..., async tx => ...)` para
 * asegurar aislamiento transaccional cross-tenant.
 */
import prisma from "~/platform/db/prisma.server.js";
import { withRls } from "~/platform/db/rls.server.js";
import { Prisma } from "@prisma/client";

export { Prisma };

const PARTIAL_SELECT = {
  id: true,
  user: {
    select: {
      userId: true,
      userName: true,
      role: { select: { roleName: true } },
    },
  },
  content: true,
  at: true,
};

/**
 * @param {number} requestId
 * @returns {Promise<{ organizationId: bigint } | null>}
 */
export async function findRequestOrgId(requestId) {
  return prisma.request.findUnique({
    where: { requestId },
    select: { organizationId: true },
  });
}

/**
 * @param {number} userId
 * @returns {Promise<{ organizationId: bigint } | null>}
 */
export async function findUserOrgId(userId) {
  return prisma.user.findUnique({
    where: { userId },
    select: { organizationId: true },
  });
}

/**
 * @param {bigint} organizationId
 * @param {{ requestId: number; userId: number; content: string }} data
 */
export async function insertCommentRls(organizationId, data) {
  return withRls(organizationId, {}, async (tx) => {
    return tx.requestComment.create({ data });
  });
}

/**
 * @param {bigint} organizationId
 * @param {object} query - Prisma findMany args (where/take/orderBy/cursor/skip)
 * @returns {Promise<object[]>}
 */
export async function listCommentsRls(organizationId, query) {
  return withRls(organizationId, {}, async (tx) =>
    tx.requestComment.findMany({ ...query, select: PARTIAL_SELECT }),
  );
}
