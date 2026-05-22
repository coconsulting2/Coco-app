/**
 * @module refundDashboardQueries
 * @description Queries Prisma para el dashboard de reembolsos del usuario.
 * Extracción Fase 6 desde refundController.getRefundDashboardByUser.
 */
import prisma from "~/platform/db/prisma.server.js";

/**
 * @param {number} userId
 * @returns {Promise<{ userId: number, wallet: any, organizationId: bigint } | null>}
 */
export async function findUserWalletAndOrg(userId) {
  return prisma.user.findUnique({
    where: { userId: Number(userId) },
    select: { userId: true, wallet: true, organizationId: true },
  });
}

/**
 * Lista solicitudes del usuario con receipts para calcular reembolsos.
 * @param {number} userId
 * @returns {Promise<object[]>}
 */
export async function findUserRequestsWithReceipts(userId) {
  return prisma.request.findMany({
    where: { userId: Number(userId) },
    select: {
      requestId: true,
      requestStatusId: true,
      creationDate: true,
      tripEndDate: true,
      requestedFee: true,
      imposedFee: true,
      notes: true,
      receipts: {
        select: {
          receiptId: true,
          amount: true,
          refund: true,
          validation: true,
          submissionDate: true,
        },
      },
    },
    orderBy: [{ creationDate: "desc" }],
  });
}
