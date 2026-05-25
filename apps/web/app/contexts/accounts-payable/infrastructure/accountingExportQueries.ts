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
import type { Prisma } from "@coco/db";
import type { RequestForExport } from "~/contexts/accounts-payable/infrastructure/accountingExportModel.js";
import type { AccountingPoliza } from "~/contexts/accounts-payable/domain/entities/AccountingPoliza";

/**
 * Cliente transaccional del Prisma extendido del web app. Derivado del callback
 * real de `$transaction` para incluir las extensiones (trigger + tenant).
 */
export type WebTransactionClient = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];

export interface ExportSingleRequestTxArgs {
  request: RequestForExport;
  polizas: AccountingPoliza[];
  /** Marca registrada en cada póliza persistida (siempre exportada en este flujo). */
  requestMarkedExported?: boolean;
}

export interface ExportBatchRequestsTxArgs {
  built: Array<{ request: RequestForExport; polizas: AccountingPoliza[] }>;
  requestIds: number[];
  requestMarkedExported?: boolean;
}

/**
 * Persiste las pólizas de un Request dentro de una transacción. Único punto del
 * slice que escribe `accounting_poliza` desde el flujo de exportación; vive en
 * infrastructure para mantener Prisma fuera de la capa de aplicación.
 */
async function persistPolizasTx(
  tx: WebTransactionClient,
  request: RequestForExport,
  polizas: AccountingPoliza[],
  requestMarkedExported: boolean,
): Promise<void> {
  if (polizas.length === 0) return;
  await tx.accountingPoliza.createMany({
    data: polizas.map((p, idx) => ({
      organizationId: request.organizationId,
      requestId: request.requestId,
      polizaIndex: idx,
      docType: String(p.header?.DOC_TYPE || "").slice(0, 2),
      payload: p as unknown as Prisma.InputJsonValue,
      requestMarkedExported: Boolean(requestMarkedExported),
    })),
  });
}

/** Transacción que persiste pólizas + marca el Request como exportado. */
export async function exportSingleRequestTx({
  request,
  polizas,
  requestMarkedExported = true,
}: ExportSingleRequestTxArgs): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await persistPolizasTx(tx, request, polizas, requestMarkedExported);
    await tx.request.updateMany({
      where: { requestId: request.requestId },
      data: { isExported: true, exportedAt: new Date() },
    });
  });
}

/** Transacción que persiste pólizas de varios Requests en batch. */
export async function exportBatchRequestsTx({
  built,
  requestIds,
  requestMarkedExported = true,
}: ExportBatchRequestsTxArgs): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const { request, polizas } of built) {
      await persistPolizasTx(tx, request, polizas, requestMarkedExported);
    }
    await tx.request.updateMany({
      where: { requestId: { in: requestIds } },
      data: { isExported: true, exportedAt: new Date() },
    });
  });
}
