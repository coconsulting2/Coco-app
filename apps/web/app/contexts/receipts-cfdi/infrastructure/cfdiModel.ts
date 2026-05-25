/**
 * @module cfdiModel
 * @description CFDI UUID lookups against `cfdi_comprobantes` (tabla normalizada, alineada con M1-003).
 * El alta completa del CFDI + acuse SAT va en POST /api/comprobantes/:receipt_id (comprobantesModel).
 */
import prisma from "~/platform/db/prisma.server.js";

/** Referencia mínima de un CFDI por UUID (folio fiscal). */
export type CfdiUuidRef = { receiptId: number; uuid: string };

const CfdiModel = {
  /** Detecta si el UUID (folio fiscal) ya está registrado en cfdi_comprobantes. */
  async findByCfdiUuid(uuid: string): Promise<CfdiUuidRef | null> {
    return prisma.cfdiComprobante.findUnique({
      where: { uuid },
      select: { receiptId: true, uuid: true },
    });
  },

  /** Busca por UUID sin depender del casing guardado en BD. */
  async findByCfdiUuidInsensitive(uuid: string): Promise<CfdiUuidRef | null> {
    const u = String(uuid).trim();
    if (!u) return null;
    return prisma.cfdiComprobante.findFirst({
      where: { uuid: { equals: u, mode: "insensitive" } },
      select: { receiptId: true, uuid: true },
    });
  },
};

export default CfdiModel;
