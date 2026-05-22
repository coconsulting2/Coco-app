/**
 * @module @coco/scheduler/jobs/exchange-rate-sync
 * @description Sincroniza tipos de cambio (USD/MXN) desde un servicio externo
 * (Banxico SIE u OXR). El URL del feed se configura vía
 * `FX_FEED_URL` y la API key (si aplica) vía `FX_FEED_TOKEN`.
 *
 * Idempotente: si el row del día ya existe, se actualiza; sino se crea.
 */
import { prismaBase } from "@coco/db";
import type { CronJob, JobContext, JobResult } from "#/types.js";

type FxFeedResponse = {
  rates?: Record<string, number>;
  base?: string;
  timestamp?: number;
};

async function fetchFx(url: string, token: string | undefined): Promise<FxFeedResponse> {
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    throw new Error(`FX feed responded ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as FxFeedResponse;
}

async function run(ctx: JobContext): Promise<JobResult> {
  const { log } = ctx;
  const url = process.env.FX_FEED_URL;
  if (!url) {
    log.warn("FX_FEED_URL no configurado; skip");
    return { ok: true, scanned: 0, processed: 0, failed: 0 };
  }
  const token = process.env.FX_FEED_TOKEN;
  try {
    const feed = await fetchFx(url, token);
    const mxn = feed.rates?.MXN;
    if (!mxn || !Number.isFinite(mxn)) {
      throw new Error("FX feed sin MXN o no numérico");
    }
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Tabla `exchangeRate` puede no existir en el schema; usamos raw para que
    // el job no rompa si el modelo aún no se introdujo. Cuando exista, este
    // job se actualiza para usar el delegate tipado.
    await prismaBase.$executeRaw`
      INSERT INTO exchange_rate (currency_pair, rate, recorded_at)
      VALUES ('USD/MXN', ${mxn}, ${today})
      ON CONFLICT (currency_pair, recorded_at) DO UPDATE SET rate = EXCLUDED.rate
    `;
    log.info({ rate: mxn }, "FX rate synced");
    return { ok: true, scanned: 1, processed: 1, failed: 0 };
  } catch (err) {
    log.error({ err: (err as Error).message }, "exchange-rate-sync failed");
    return { ok: false, scanned: 0, processed: 0, failed: 1 };
  }
}

export const exchangeRateSyncJob: CronJob = {
  name: "exchange-rate-sync",
  schedule: process.env.SCHEDULER_FX_SYNC_CRON ?? "0 1 * * *",
  timezone: process.env.TZ ?? "America/Mexico_City",
  run,
};
