/**
 * @module accountingExportModel
 * @description Capa de acceso a datos para la exportacion contable (polizas AV/GV hacia el ERP).
 * Lee Request + User + Department + Receipt + CfdiComprobante en una sola consulta Prisma
 * con la forma que el servicio de exportacion necesita.
 */
import prisma from "~/platform/db/prisma.server.js";
import { Prisma } from "@coco/db";

/** Campos de inclusion reutilizados en todas las consultas de exportacion. */
const EXPORT_INCLUDE = {
  user: { include: { department: true, empleado: true } },
  organization: {
    include: {
      chartOfAccounts: { where: { active: true } },
      accountingSocieties: true,
    },
  },
  requestStatus: true,
  receipts: {
    where: { validation: "Aprobado" },
    include: { cfdiComprobante: true, receiptType: true },
    orderBy: { receiptId: "asc" },
  },
} satisfies Prisma.RequestInclude;

/** Request con todos los joins que una póliza contable requiere. */
export type RequestForExport = Prisma.RequestGetPayload<{ include: typeof EXPORT_INCLUDE }>;

const AccountingExport = {
  /**
   * Obtiene un Request con todo lo que una poliza contable requiere.
   */
  async getRequestForExport(requestId: number): Promise<RequestForExport | null> {
    return prisma.request.findUnique({
      where: { requestId: Number(requestId) },
      include: EXPORT_INCLUDE,
    });
  },

  /**
   * Obtiene todos los Requests Finalizados con al menos un recibo Aprobado cuya
   * validationDate cae en [from, to], o (respaldo) validationDate nula y submissionDate en rango.
   */
  async getFinalizedRequestsInRange(
    from: Date,
    to: Date,
    force = false,
  ): Promise<RequestForExport[]> {
    const where: Prisma.RequestWhereInput = {
      requestStatusId: 8, // Finalizado
      receipts: {
        some: {
          validation: "Aprobado",
          OR: [
            { validationDate: { gte: from, lte: to } },
            {
              AND: [
                { validationDate: null },
                { submissionDate: { gte: from, lte: to } },
              ],
            },
          ],
        },
      },
    };

    if (!force) {
      where.isExported = false;
    }

    return prisma.request.findMany({
      where,
      include: EXPORT_INCLUDE,
      orderBy: { requestId: "asc" },
    });
  },

  /**
   * Marca un conjunto de Requests como exportados al ERP.
   */
  async markRequestsAsExported(requestIds: number[]): Promise<void> {
    if (!requestIds || requestIds.length === 0) return;
    await prisma.request.updateMany({
      where: { requestId: { in: requestIds } },
      data: {
        isExported: true,
        exportedAt: new Date(),
      },
    });
  },
};

export default AccountingExport;
