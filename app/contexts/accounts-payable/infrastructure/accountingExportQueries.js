/**
 * @module accountingExportQueries
 * @description Wrappers transaccionales para exportación contable (pólizas
 * AV/GV → ERP). Extracción Fase 6 de las 2 transacciones inline en
 * accountingExportService.
 *
 * Patrón: el service pasa un callback `persistFn(tx, request, polizas, force)`
 * que define la lógica de persistencia; este wrapper solo arma la transacción.
 */
import prisma from "~/platform/db/prisma.server.js";

/**
 * Transacción que persiste pólizas + marca el Request como exportado.
 *
 * @param {{
 *   request: object;
 *   polizas: object[];
 *   persistFn: (tx: any, request: object, polizas: object[], force: boolean) => Promise<void>;
 *   force?: boolean;
 * }} args
 */
export async function exportSingleRequestTx({ request, polizas, persistFn, force = true }) {
  return prisma.$transaction(async (tx) => {
    await persistFn(tx, request, polizas, force);
    await tx.request.updateMany({
      where: { requestId: request.requestId },
      data: { isExported: true, exportedAt: new Date() },
    });
  });
}

/**
 * Transacción que persiste pólizas de varios Requests en batch.
 *
 * @param {{
 *   built: Array<{ request: object; polizas: object[] }>;
 *   requestIds: number[];
 *   persistFn: (tx: any, request: object, polizas: object[], force: boolean) => Promise<void>;
 *   force?: boolean;
 * }} args
 */
export async function exportBatchRequestsTx({ built, requestIds, persistFn, force = true }) {
  return prisma.$transaction(async (tx) => {
    for (const { request, polizas } of built) {
      await persistFn(tx, request, polizas, force);
    }
    await tx.request.updateMany({
      where: { requestId: { in: requestIds } },
      data: { isExported: true, exportedAt: new Date() },
    });
  });
}
