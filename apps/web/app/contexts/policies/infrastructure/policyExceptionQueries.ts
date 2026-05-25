/**
 * @module policyExceptionQueries
 * @description Adapter Prisma del puerto PolicyExceptionQueriesPort
 * (PolicyException CRUD + side-effect transaccional de decisión).
 */
import prisma from "~/platform/db/prisma.server.js";
import type {
  DecideExceptionArgs,
  ExceptionWithRequest,
  PendingExceptionWithJoins,
  PolicyExceptionQueriesPort,
  RequestForException,
} from "~/contexts/policies/domain/ports/PolicyExceptionQueriesPort";
import type { PolicyExceptionRow } from "~/contexts/policies/domain/types";

export async function findRequestForException(
  requestId: number,
): Promise<RequestForException | null> {
  return prisma.request.findUnique({
    where: { requestId: Number(requestId) },
    select: { requestId: true, workflowPreSnapshot: true, userId: true, organizationId: true },
  }) as unknown as Promise<RequestForException | null>;
}

export async function createPolicyException(data: {
  organizationId: bigint | number;
  requestId: number;
  receiptId: number | null;
  policyId: number | null;
  capId: number | null;
  amountClaimed: number;
  amountAllowed: number | null;
  excessAmount: number;
  justification: string;
  status: string;
  requestedById: number;
}): Promise<PolicyExceptionRow> {
  return prisma.policyException.create({
    data: data as never,
  }) as unknown as Promise<PolicyExceptionRow>;
}

export async function findExceptionWithRequest(
  exceptionId: number,
): Promise<ExceptionWithRequest | null> {
  return prisma.policyException.findUnique({
    where: { exceptionId: Number(exceptionId) },
    include: {
      request: { select: { workflowPreSnapshot: true, userId: true, organizationId: true } },
    },
  }) as unknown as Promise<ExceptionWithRequest | null>;
}

export async function decideExceptionTx(
  args: DecideExceptionArgs,
): Promise<PolicyExceptionRow> {
  return prisma.$transaction(async (tx) => {
    const row = await tx.policyException.update({
      where: { exceptionId: args.exceptionId },
      data: args.exceptionUpdate as never,
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
      } as never,
    });
    return row;
  }) as unknown as Promise<PolicyExceptionRow>;
}

export async function findPendingExceptionsForRequest(
  requestId: number,
): Promise<PolicyExceptionRow[]> {
  return prisma.policyException.findMany({
    where: { requestId: Number(requestId), status: "PENDING" },
    orderBy: [{ createdAt: "asc" }],
  }) as unknown as Promise<PolicyExceptionRow[]>;
}

export async function findAllPendingExceptions(): Promise<PendingExceptionWithJoins[]> {
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
  }) as unknown as Promise<PendingExceptionWithJoins[]>;
}

/** Adapter pre-wireado del puerto PolicyExceptionQueriesPort. */
export const prismaPolicyExceptionQueries: PolicyExceptionQueriesPort = {
  findRequestForException,
  createPolicyException,
  findExceptionWithRequest,
  decideExceptionTx,
  findPendingExceptionsForRequest,
  findAllPendingExceptions,
};
