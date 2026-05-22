// @ts-nocheck — legacy CFDI logic; typed properly is M9 follow-up
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @module comprobantesQueries
 * @description Queries Prisma para CFDI Comprobante (parte internacional/SAT).
 * Extracción Fase 6 desde comprobantesService (application/).
 */
import prisma from "~/platform/db/prisma.server.js";

/**
 * @param {number} receiptId
 * @returns {Promise<object | null>}
 */
export async function findCfdiByReceiptId(receiptId: any) {
  return prisma.cfdiComprobante.findUnique({
    where: { receiptId: Number(receiptId) },
  });
}

/**
 * Transacción atómica: actualiza Receipt + crea CfdiComprobante.
 *
 * @param {{
 *   receiptId: number;
 *   receiptUpdate: object;
 *   cfdiData: object;
 * }} args
 * @returns {Promise<object>}
 */
export async function upsertReceiptWithCfdiTx({ receiptId, receiptUpdate, cfdiData }: any) {
  return prisma.$transaction(async (tx) => {
    await tx.receipt.update({
      where: { receiptId: Number(receiptId) },
      data: receiptUpdate,
    });
    return tx.cfdiComprobante.create({ data: cfdiData });
  });
}
