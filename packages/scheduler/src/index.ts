/**
 * @module @coco/scheduler
 * @description Public API del worker (cron jobs independientes del web app).
 * El entry point ejecutable es `runner.ts` — corre con `bun --filter @coco/scheduler start`.
 */
export type { CronJob, JobContext, JobResult } from "#/types.js";
export { allJobs } from "#/jobs/index.js";
export { logger } from "#/logger.js";
