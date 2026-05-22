// @ts-nocheck — bulk-converted legacy; typed properly is M9 follow-up
/**
 * @module anticipoPolizaQueries
 * @description Queries Prisma para snapshots de pólizas AV. Extracción Fase 6.
 * Re-exporta `Prisma` (es un namespace de tipos, no el cliente).
 */
import { Prisma } from "@prisma/client";
import prisma from "~/platform/db/prisma.server.js";

export { Prisma };

/**
 * Request con joins necesarios para construir la póliza AV.
 *
 * @param {number} requestId
 * @returns {Promise<object | null>}
 */
export async function findRequestWithAccountingContext(requestId) {
  return prisma.request.findUnique({
    where: { requestId: Number(requestId) },
    include: {
      user: { include: { empleado: true, department: true } },
      organization: {
        include: {
          chartOfAccounts: { where: { active: true } },
          accountingSocieties: true,
        },
      },
    },
  });
}

/**
 * Inserta un snapshot de póliza. Idempotente vía unique constraint
 * (organizationId, requestId, phase) — duplicate (P2002) se silencia.
 *
 * @param {{ organizationId: bigint; requestId: number; phase: string; payload: object }} data
 * @returns {Promise<object | null>}
 */
export async function createAnticipoPolizaSnapshot(data) {
  try {
    return await prisma.anticipoPolizaSnapshot.create({ data });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return null;
    }
    throw err;
  }
}

/**
 * Lookup minimal del Request por requestedFee.
 *
 * @param {number} requestId
 * @returns {Promise<{ requestedFee: any } | null>}
 */
export async function findRequestedFee(requestId) {
  return prisma.request.findUnique({
    where: { requestId: Number(requestId) },
    select: { requestedFee: true },
  });
}

/**
 * Lookup minimal del Request por imposedFee.
 *
 * @param {number} requestId
 * @returns {Promise<{ imposedFee: any } | null>}
 */
export async function findImposedFee(requestId) {
  return prisma.request.findUnique({
    where: { requestId: Number(requestId) },
    select: { imposedFee: true },
  });
}
