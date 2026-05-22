/**
 * @module @coco/scheduler/jobs/sat-validate-batch
 * @description Procesa en lote los CFDIs pendientes de validación SAT.
 *   Estrategia:
 *     1. Selecciona CfdiComprobante con `sat_estado IS NULL` o `sat_estado = ''`.
 *     2. Para cada uno, llama `consultarCfdiWithRetries` (@coco/integrations).
 *     3. Actualiza el row con `acuseToCfdiRow(acuse)`.
 *   Idempotente: filas con `sat_estado` ya seteado no se reprocesan.
 */
import { prismaBase, withTenantContext } from "@coco/db";
import { sat } from "@coco/integrations";
import type { CronJob, JobContext, JobResult } from "#/types.js";

const BATCH_SIZE = 50;

async function run(ctx: JobContext): Promise<JobResult> {
  const { log, signal } = ctx;
  const pending = await prismaBase.cfdiComprobante.findMany({
    where: { satEstado: "" },
    take: BATCH_SIZE,
    select: {
      cfdiId: true,
      organizationId: true,
      uuid: true,
      rfcEmisor: true,
      rfcReceptor: true,
      total: true,
    },
  });

  let processed = 0;
  let failed = 0;

  for (const row of pending) {
    if (signal.aborted) {
      log.warn({ processed, failed }, "sat-validate-batch aborted mid-run");
      break;
    }
    try {
      const acuse = await sat.consultarCfdiWithRetries({
        rfcEmisor: row.rfcEmisor,
        rfcReceptor: row.rfcReceptor,
        total: Number(row.total),
        uuid: row.uuid,
        selloUltimos8: null,
      });
      const fields = sat.acuseToCfdiRow(acuse);
      await withTenantContext({ organizationId: row.organizationId }, async () =>
        prismaBase.cfdiComprobante.update({
          where: { cfdiId: row.cfdiId },
          data: {
            satCodigoEstatus: fields.sat_codigo_estatus,
            satEstado: fields.sat_estado,
            satEsCancelable: fields.sat_es_cancelable,
            satEstatusCancelacion: fields.sat_estatus_cancelacion,
            satValidacionEfos: fields.sat_validacion_efos,
          },
        }),
      );
      processed += 1;
    } catch (err) {
      failed += 1;
      log.error({ cfdiId: row.cfdiId, err: (err as Error).message }, "SAT consulta failed");
    }
  }

  return {
    ok: failed === 0,
    scanned: pending.length,
    processed,
    failed,
  };
}

export const satValidateBatchJob: CronJob = {
  name: "sat-validate-batch",
  schedule: process.env.SCHEDULER_SAT_VALIDATE_CRON ?? "*/5 * * * *",
  timezone: process.env.TZ ?? "America/Mexico_City",
  run,
};
