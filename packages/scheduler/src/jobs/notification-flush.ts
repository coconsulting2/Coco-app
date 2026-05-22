/**
 * @module @coco/scheduler/jobs/notification-flush
 * @description Marca notificaciones expiradas como leídas y archiva ruido viejo
 * (> 90 días sin abrir). Idempotente.
 */
import { prismaBase } from "@coco/db";
import type { CronJob, JobContext, JobResult } from "#/types.js";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

async function run(ctx: JobContext): Promise<JobResult> {
  const { log } = ctx;
  const cutoff = new Date(Date.now() - NINETY_DAYS_MS);
  const result = await prismaBase.notification.updateMany({
    where: {
      isRead: false,
      createdAt: { lt: cutoff },
    },
    data: { isRead: true },
  });
  log.info({ archived: result.count }, "notification-flush completed");
  return { ok: true, scanned: result.count, processed: result.count, failed: 0 };
}

export const notificationFlushJob: CronJob = {
  name: "notification-flush",
  schedule: process.env.SCHEDULER_NOTIFICATION_FLUSH_CRON ?? "0 * * * *",
  timezone: process.env.TZ ?? "America/Mexico_City",
  run,
};
