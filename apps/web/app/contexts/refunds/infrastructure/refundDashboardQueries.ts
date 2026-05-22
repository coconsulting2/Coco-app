/**
 * @module refundDashboardQueries
 * @description Queries Prisma para el dashboard de reembolsos del usuario.
 */
import prisma from "~/platform/db/prisma.server.js";

export type UserWalletOrg = {
  userId: number;
  wallet: unknown;
  organizationId: bigint;
};

export type RequestWithReceipts = {
  requestId: number;
  requestStatusId: number;
  creationDate: Date;
  tripEndDate: Date | null;
  requestedFee: unknown;
  imposedFee: unknown;
  notes: string | null;
  receipts: Array<{
    receiptId: number;
    amount: unknown;
    refund: unknown;
    validation: string;
    submissionDate: Date | null;
  }>;
};

export async function findUserWalletAndOrg(
  userId: number,
): Promise<UserWalletOrg | null> {
  return prisma.user.findUnique({
    where: { userId: Number(userId) },
    select: { userId: true, wallet: true, organizationId: true },
  }) as Promise<UserWalletOrg | null>;
}

export async function findUserRequestsWithReceipts(
  userId: number,
): Promise<RequestWithReceipts[]> {
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
  }) as Promise<RequestWithReceipts[]>;
}
