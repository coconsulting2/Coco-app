/**
 * @module @coco/scheduler/logger
 * @description Logger pino dedicado al worker process. Si pino-pretty está
 * disponible (dev) se usa transport bonito; en prod escribe JSON a stdout.
 */
import pino from "pino";

const pretty = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "@coco/scheduler" },
  ...(pretty
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:HH:MM:ss" },
        },
      }
    : {}),
});

export type Logger = typeof logger;
