#!/usr/bin/env bun
/**
 * @module @coco/scheduler/runner
 * @description Entry-point del worker process. Carga `.env`, conecta @coco/db,
 * registra los CronJobs y queda escuchando. Termina gracefully en SIGINT/SIGTERM.
 */
import "dotenv/config";
import cron from "node-cron";
import { connectPostgres, disconnectPostgres } from "@coco/db";
import { logger } from "#/logger.js";
import { allJobs } from "#/jobs/index.js";
import type { CronJob } from "#/types.js";

type ScheduledTask = {
  job: CronJob;
  task: ReturnType<typeof cron.schedule>;
};

const scheduled: ScheduledTask[] = [];
let shuttingDown = false;

function scheduleJob(job: CronJob, abortController: AbortController): void {
  const task = cron.schedule(
    job.schedule,
    async () => {
      if (shuttingDown) return;
      const startedAt = new Date().toISOString();
      const child = logger.child({ job: job.name, startedAt });
      child.info("job start");
      try {
        const result = await job.run({
          log: child,
          signal: abortController.signal,
          startedAt,
        });
        child.info({ ...result }, "job done");
      } catch (err) {
        child.error({ err: (err as Error).message }, "job crashed");
      }
    },
    { timezone: job.timezone ?? "America/Mexico_City" },
  );
  scheduled.push({ job, task });
  logger.info({ job: job.name, schedule: job.schedule }, "scheduled");
}

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.warn({ signal }, "shutting down");
  for (const { task } of scheduled) {
    try {
      task.stop();
    } catch {
      /* ignore */
    }
  }
  await disconnectPostgres().catch(() => {
    /* ignore */
  });
  process.exit(0);
}

async function main(): Promise<void> {
  await connectPostgres();
  const abortController = new AbortController();

  for (const job of allJobs) {
    scheduleJob(job, abortController);
  }

  process.on("SIGINT", () => {
    abortController.abort();
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    abortController.abort();
    void shutdown("SIGTERM");
  });

  logger.info({ jobs: allJobs.map((j) => j.name) }, "scheduler online");
}

main().catch((err) => {
  logger.error({ err: (err as Error).message }, "fatal");
  process.exit(1);
});
