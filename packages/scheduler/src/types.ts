/**
 * @module @coco/scheduler/types
 * @description Tipos compartidos para el sistema de jobs.
 */
import type { Logger } from "pino";

export type JobContext = {
  log: Logger;
  signal: AbortSignal;
  /** Timestamp de inicio del run (ISO). */
  startedAt: string;
};

export type JobResult = {
  ok: boolean;
  scanned: number;
  processed: number;
  failed: number;
  detail?: Record<string, unknown>;
};

export type CronJob = {
  /** Identificador único del job (kebab-case). Usado en logs y en config. */
  name: string;
  /** Expresión cron 5-field (compatible con node-cron). */
  schedule: string;
  /** Timezone IANA (default `America/Mexico_City`). */
  timezone?: string;
  /** Handler async. Debe ser idempotente y abortable vía `ctx.signal`. */
  run: (ctx: JobContext) => Promise<JobResult>;
};
