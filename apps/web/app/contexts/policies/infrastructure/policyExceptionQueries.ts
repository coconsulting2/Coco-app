// @ts-nocheck — bulk-converted legacy; typed properly is M9 follow-up
/**
 * @module policyExceptionQueries
 * @description Queries Prisma para PolicyException CRUD + side-effect transaccional.
 * Extracción Fase 6 desde policyExceptionService.
 */
import prisma from "~/platform/db/prisma.server.js";

/**
 * @param {number} requestId
 * @returns {Promise<object | null>}
 */
export async function findRequestForException(requestId) {
  return prisma.request.findUnique({
    where: { requestId: Number(requestId) },
    select: { requestId: true, workflowPreSnapshot: true, userId: true, organizationId: true },
  });
}

/**
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function createPolicyException(data) {
  return prisma.policyException.create({ data });
}

/**
 * @param {number} exceptionId
 * @returns {Promise<object | null>}
 */
export async function findExceptionWithRequest(exceptionId) {
  return prisma.policyException.findUnique({
    where: { exceptionId: Number(exceptionId) },
    include: {
      request: { select: { workflowPreSnapshot: true, userId: true, organizationId: true } },
    },
  });
}

/**
 * Side-effect transaccional: actualiza PolicyException + Receipt + inserta
 * SolicitudHistorial. Atómico.
 *
 * @param {{
 *   exceptionId: number,
 *   exceptionUpdate: object,
 *   receiptId: number | null,
 *   refundFlag: boolean,
 *   requestId: number,
 *   organizationId: bigint | number,
 *   decidedById: number,
 *   accion: string,
 *   comentario: string
 * }} args
 * @returns {Promise<object>}
 */
export async function decideExceptionTx(args) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.policyException.update({
      where: { exceptionId: args.exceptionId },
      data: args.exceptionUpdate,
    });
    if (args.receiptId) {
      await tx.receipt.update({
        where: { receiptId: args.receiptId },
        data: { refund: args.refundFlag },
      });
    }
    await tx.solicitudHistorial.create({
      data: {
        organizationId: args.organizationId,
        requestId: args.requestId,
        userId: args.decidedById,
        accion: args.accion,
        comentario: args.comentario,
      },
    });
    return row;
  });
}

/**
 * @param {number} requestId
 * @returns {Promise<object[]>}
 */
export async function findPendingExceptionsForRequest(requestId) {
  return prisma.policyException.findMany({
    where: { requestId: Number(requestId), status: "PENDING" },
    orderBy: [{ createdAt: "asc" }],
  });
}

/**
 * @returns {Promise<object[]>}
 */
export async function findAllPendingExceptions() {
  return prisma.policyException.findMany({
    where: { status: "PENDING" },
    include: {
      receipt: {
        select: {
          receiptId: true,
          amount: true,
          receiptType: { select: { receiptTypeName: true } },
        },
      },
      request: { select: { requestId: true, userId: true, workflowPreSnapshot: true } },
    },
    orderBy: [{ createdAt: "asc" }],
  });
}
