/**
 * @module comprobantesQueries
 * @description Queries Prisma para CFDI Comprobante (parte internacional/SAT).
 * Convertido a TS proper en M9 — antes carecia de chequeo de tipos.
 */
import prisma from "~/platform/db/prisma.server.js";
import { Prisma, type CfdiComprobante } from "@coco/db";

/** Busca el CFDI ligado a un recibo (único por receiptId). */
export async function findCfdiByReceiptId(
  receiptId: number,
): Promise<CfdiComprobante | null> {
  return prisma.cfdiComprobante.findUnique({
    where: { receiptId: Number(receiptId) },
  });
}

export type UpsertReceiptWithCfdiArgs = {
  receiptId: number;
  /** Campos del Receipt a actualizar (camelCase Prisma). */
  receiptUpdate: Prisma.ReceiptUncheckedUpdateInput;
  /** Datos completos del CfdiComprobante a crear (camelCase Prisma, sin organizationId). */
  cfdiData: Record<string, unknown>;
};

/**
 * Transacción atómica: actualiza Receipt + crea CfdiComprobante.
 * `organizationId` lo inyecta el tenantExtension en runtime.
 */
export async function upsertReceiptWithCfdiTx({
  receiptId,
  receiptUpdate,
  cfdiData,
}: UpsertReceiptWithCfdiArgs): Promise<CfdiComprobante> {
  const createData =
    cfdiData as unknown as Prisma.CfdiComprobanteUncheckedCreateInput;
  return prisma.$transaction(async (tx) => {
    await tx.receipt.update({
      where: { receiptId: Number(receiptId) },
      data: receiptUpdate,
    });
    return tx.cfdiComprobante.create({ data: createData });
  });
}
