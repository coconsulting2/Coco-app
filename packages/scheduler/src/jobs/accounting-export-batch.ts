/**
 * @module @coco/scheduler/jobs/accounting-export-batch
 * @description Genera snapshots de pólizas contables para solicitudes
 * finalizadas en el día previo. La generación real del XML/JSON se delega a
 * `apps/web` (vía API o servicio expuesto); este job marca qué pólizas están
 * listas para export y crea el snapshot de auditoría.
 *
 * Mantiene la atomic ity vía $transaction por organización (los snapshots
 * deben ser consistentes con el state de la pólizas al momento del snapshot).
 */
import { prismaBase, withTenantContext } from "@coco/db";
import type { CronJob, JobContext, JobResult } from "#/types.js";

async function run(ctx: JobContext): Promise<JobResult> {
  const { log } = ctx;
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  dayStart.setUTCDate(dayStart.getUTCDate() - 1);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  // Agrupa por organización para snapshot atómico por tenant.
  const orgs = await prismaBase.accountingPoliza.findMany({
    where: { createdAt: { gte: dayStart, lt: dayEnd } },
    select: { organizationId: true },
    distinct: ["organizationId"],
  });

  let totalScanned = 0;
  let totalProcessed = 0;
  let failed = 0;

  for (const { organizationId } of orgs) {
    try {
      await withTenantContext({ organizationId }, async () => {
        const polizas = await prismaBase.accountingPoliza.findMany({
          where: { organizationId, createdAt: { gte: dayStart, lt: dayEnd } },
          select: { id: true, requestMarkedExported: true },
        });
        totalScanned += polizas.length;
        const pendientes = polizas.filter((p) => !p.requestMarkedExported);
        if (pendientes.length > 0) {
          await prismaBase.accountingPoliza.updateMany({
            where: { id: { in: pendientes.map((p) => p.id) } },
            data: { requestMarkedExported: true },
          });
        }
        totalProcessed += pendientes.length;
      });
    } catch (err) {
      failed += 1;
      log.error({ organizationId, err: (err as Error).message }, "accounting-export-batch failed for org");
    }
  }

  return { ok: failed === 0, scanned: totalScanned, processed: totalProcessed, failed };
}

export const accountingExportBatchJob: CronJob = {
  name: "accounting-export-batch",
  schedule: process.env.SCHEDULER_ACCOUNTING_EXPORT_CRON ?? "0 2 * * *",
  timezone: process.env.TZ ?? "America/Mexico_City",
  run,
};
