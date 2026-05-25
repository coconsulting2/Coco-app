/**
 * @module anticipoPolizaQueries
 * @description Queries Prisma para snapshots de pólizas AV. Extracción Fase 6.
 * Re-exporta `Prisma` (es un namespace de tipos, no el cliente).
 */
import { Prisma } from "@coco/db";
import prisma from "~/platform/db/prisma.server.js";
import type { AccountingPoliza } from "~/contexts/accounts-payable/domain/entities/AccountingPoliza";

export { Prisma };

/** Includes necesarios para construir la póliza AV de un Request. */
const ACCOUNTING_CONTEXT_INCLUDE = {
  user: { include: { empleado: true, department: true } },
  organization: {
    include: {
      chartOfAccounts: { where: { active: true } },
      accountingSocieties: true,
    },
  },
} satisfies Prisma.RequestInclude;

/** Request con joins contables para construir la póliza AV. */
export type RequestWithAccountingContext = Prisma.RequestGetPayload<{
  include: typeof ACCOUNTING_CONTEXT_INCLUDE;
}>;

/** Datos para persistir un snapshot de póliza AV. */
export interface AnticipoPolizaSnapshotData {
  organizationId: bigint;
  requestId: number;
  phase: string;
  payload: AccountingPoliza;
}

/** Request con joins necesarios para construir la póliza AV. */
export async function findRequestWithAccountingContext(
  requestId: number,
): Promise<RequestWithAccountingContext | null> {
  return prisma.request.findUnique({
    where: { requestId: Number(requestId) },
    include: ACCOUNTING_CONTEXT_INCLUDE,
  });
}

/**
 * Inserta un snapshot de póliza. Idempotente vía unique constraint
 * (requestId, phase) — duplicate (P2002) se silencia.
 */
export async function createAnticipoPolizaSnapshot(
  data: AnticipoPolizaSnapshotData,
): Promise<{ id: number } | null> {
  try {
    return await prisma.anticipoPolizaSnapshot.create({
      data: {
        organizationId: data.organizationId,
        requestId: data.requestId,
        phase: data.phase,
        payload: data.payload as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return null;
    }
    throw err;
  }
}

/** Lookup minimal del Request por requestedFee. */
export async function findRequestedFee(
  requestId: number,
): Promise<{ requestedFee: number | null } | null> {
  return prisma.request.findUnique({
    where: { requestId: Number(requestId) },
    select: { requestedFee: true },
  });
}

/** Lookup minimal del Request por imposedFee. */
export async function findImposedFee(
  requestId: number,
): Promise<{ imposedFee: number | null } | null> {
  return prisma.request.findUnique({
    where: { requestId: Number(requestId) },
    select: { imposedFee: true },
  });
}
