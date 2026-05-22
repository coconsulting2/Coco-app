/**
 * @module reimbursementTimeQueries
 * @description Queries Prisma para configuración de tiempo límite de
 * reembolso y bloqueo de solicitudes vencidas.
 */
import prisma from "~/platform/db/prisma.server.js";

export async function findTimeLimitByOrg(
  organizationId: bigint | number,
): Promise<unknown> {
  return prisma.reimbursementTimeLimit.findUnique({
    where: { organizationId: BigInt(organizationId) },
  });
}

export async function upsertTimeLimit(
  organizationId: bigint | number,
  data: Record<string, unknown>,
): Promise<unknown> {
  return prisma.reimbursementTimeLimit.upsert({
    where: { organizationId: BigInt(organizationId) },
    update: data,
    create: { organizationId: BigInt(organizationId), ...data } as never,
  });
}

export async function findRequestForDeadline(requestId: number): Promise<unknown> {
  return prisma.request.findUnique({
    where: { requestId: Number(requestId) },
    select: {
      requestId: true,
      tripEndDate: true,
      user: { select: { organizationId: true } },
    },
  });
}

export async function findExpiredCandidates(
  terminalStatusIds: number[],
): Promise<unknown[]> {
  return prisma.request.findMany({
    where: {
      tripEndDate: { not: null },
      requestStatusId: { notIn: terminalStatusIds },
    },
    select: {
      requestId: true,
      tripEndDate: true,
      requestStatusId: true,
      userId: true,
      user: { select: { organizationId: true, userId: true } },
    },
  });
}

export async function lockRequestAutomatic(
  requestId: number,
  userId: number,
  organizationId: bigint,
  comentario: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.request.update({
      where: { requestId },
      data: { requestStatusId: 8 },
    });
    await tx.solicitudHistorial.create({
      data: {
        requestId,
        userId,
        organizationId,
        accion: "RECHAZADO",
        comentario,
      },
    });
  });
}
