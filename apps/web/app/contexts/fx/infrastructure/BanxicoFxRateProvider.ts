/**
 * @module BanxicoFxRateProvider
 * @description Adapter del puerto `FxRateProvider` para USD/MXN vía la serie
 * Banxico SF43718. También cubre `BanxicoFixingProvider` (FIX para asiento
 * contable). Sólo soporta el par USD↔MXN.
 */
import type {
  Currency,
  ExchangeRate,
  RateHistoryPoint,
} from "~/contexts/fx/domain/entities/ExchangeRate.js";
import type {
  BanxicoFixingProvider,
  FxRateProvider,
} from "~/contexts/fx/domain/ports/FxProvider.js";
import {
  FxProviderUnavailableError,
  UnsupportedCurrencyError,
} from "~/contexts/fx/domain/errors.js";

const SF43718 = "SF43718";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function bmxBaseUrl(): string {
  const raw = process.env.BMX_API_URL ?? "https://www.banxico.org.mx/SieAPIRest/service/v1";
  return raw.replace(/\/+$/, "");
}

function bmxHeaders(): HeadersInit {
  const token =
    process.env.BANXICO_API_TOKEN ??
    process.env.BANXICO_TOKEN ??
    process.env.BANXICO_API_KEY ??
    "";
  return token ? { "Bmx-Token": token, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

function isUsdMxn(source: string, target: string): boolean {
  return source.toUpperCase() === "USD" && target.toUpperCase() === "MXN";
}

function parseBanxicoDate(banxicoDate: string): string {
  // dd/mm/yyyy → yyyy-mm-dd
  const m = banxicoDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return todayIso();
  return `${m[3]}-${m[2]}-${m[1]}`;
}

type BanxicoResponse = {
  bmx?: {
    series?: Array<{
      datos?: Array<{ fecha?: string; dato?: string }>;
    }>;
  };
};

export class BanxicoFxRateProvider implements FxRateProvider, BanxicoFixingProvider {
  supports(source: string, target: string): boolean {
    return isUsdMxn(source, target);
  }

  async getRate(source: string, target: string): Promise<ExchangeRate> {
    if (!this.supports(source, target)) {
      throw new UnsupportedCurrencyError(
        `Banxico solo soporta USD→MXN (recibió ${source}→${target})`,
      );
    }
    const url = `${bmxBaseUrl()}/series/${SF43718}/datos`;
    let response: Response;
    try {
      response = await fetch(url, { headers: bmxHeaders() });
    } catch (err) {
      throw new FxProviderUnavailableError(
        `Banxico no disponible: ${(err as Error).message}`,
      );
    }
    if (!response.ok) {
      throw new FxProviderUnavailableError(`Banxico HTTP ${response.status}`);
    }
    const data = (await response.json()) as BanxicoResponse;
    const datos = data.bmx?.series?.[0]?.datos;
    if (!datos || datos.length === 0) {
      throw new FxProviderUnavailableError("Banxico devolvió sin datos");
    }
    const latest = datos[datos.length - 1]!;
    const rate = Number(String(latest.dato ?? "0").replace(/,/g, ""));
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new FxProviderUnavailableError("Banxico devolvió rate inválido");
    }
    return {
      source: "USD",
      target: "MXN",
      rate,
      date: latest.fecha ? parseBanxicoDate(latest.fecha) : todayIso(),
      dataSource: "banxico",
      fromCache: false,
    };
  }

  async getRateHistory(
    source: string,
    target: string,
    startDate: string,
    endDate: string,
  ): Promise<RateHistoryPoint[]> {
    if (!this.supports(source, target)) {
      throw new UnsupportedCurrencyError(
        `Banxico history solo soporta USD→MXN (recibió ${source}→${target})`,
      );
    }
    const url = `${bmxBaseUrl()}/series/${SF43718}/datos/${startDate}/${endDate}`;
    let response: Response;
    try {
      response = await fetch(url, { headers: bmxHeaders() });
    } catch {
      // Fallback: query the full range and filter client-side.
      response = await fetch(`${bmxBaseUrl()}/series/${SF43718}/datos`, {
        headers: bmxHeaders(),
      });
    }
    if (!response.ok) {
      throw new FxProviderUnavailableError(`Banxico history HTTP ${response.status}`);
    }
    const data = (await response.json()) as BanxicoResponse;
    const datos = data.bmx?.series?.[0]?.datos ?? [];
    const start = new Date(`${startDate}T00:00:00Z`).getTime();
    const end = new Date(`${endDate}T23:59:59Z`).getTime();
    return datos
      .map<RateHistoryPoint | null>((row) => {
        const fecha = row.fecha ? parseBanxicoDate(row.fecha) : null;
        if (!fecha) return null;
        const t = new Date(`${fecha}T00:00:00Z`).getTime();
        if (Number.isNaN(t) || t < start || t > end) return null;
        const rate = Number(String(row.dato ?? "0").replace(/,/g, ""));
        if (!Number.isFinite(rate) || rate <= 0) return null;
        return { date: fecha, rate, source: "banxico" };
      })
      .filter((x): x is RateHistoryPoint => x !== null);
  }

  async getSupportedCurrencies(): Promise<Currency[]> {
    return [
      { code: "MXN", name: "Mexican Peso", symbol: "$", supportsDecimals: true },
      { code: "USD", name: "US Dollar", symbol: "$", supportsDecimals: true },
    ];
  }

  /** Direct fixing query used by accounting export for a specific posting date. */
  async fetchUsdMxnFixing(isoDate: string): Promise<number | null> {
    if (process.env.NODE_ENV === "test" || process.env.BANXICO_DISABLE === "1") return null;
    const fecha = String(isoDate || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
    const url = `${bmxBaseUrl()}/series/${SF43718}/datos/${fecha}/${fecha}`;
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(url, { headers: bmxHeaders(), signal: ctrl.signal });
      clearTimeout(tid);
      if (!res.ok) return null;
      const json = (await res.json()) as BanxicoResponse;
      const row = json.bmx?.series?.[0]?.datos?.[0];
      const dato = row?.dato;
      if (dato === undefined || dato === null) return null;
      const n = Number(String(dato).replace(/,/g, ""));
      return Number.isFinite(n) && n > 0 ? n : null;
    } catch {
      return null;
    }
  }
}
