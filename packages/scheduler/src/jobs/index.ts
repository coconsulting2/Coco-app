/**
 * @module @coco/scheduler/jobs
 * @description Registro central de jobs del worker. Para agregar uno nuevo:
 *   1. Crear `packages/scheduler/src/jobs/<name>.ts` exportando un `CronJob`.
 *   2. Importarlo aquí y agregarlo al array `allJobs`.
 *   3. El runner lo agenda automáticamente al arrancar.
 */
import { satValidateBatchJob } from "#/jobs/sat-validate-batch.js";
import { notificationFlushJob } from "#/jobs/notification-flush.js";
import { accountingExportBatchJob } from "#/jobs/accounting-export-batch.js";
import { exchangeRateSyncJob } from "#/jobs/exchange-rate-sync.js";
import type { CronJob } from "#/types.js";

export const allJobs: ReadonlyArray<CronJob> = [
  satValidateBatchJob,
  notificationFlushJob,
  accountingExportBatchJob,
  exchangeRateSyncJob,
];
