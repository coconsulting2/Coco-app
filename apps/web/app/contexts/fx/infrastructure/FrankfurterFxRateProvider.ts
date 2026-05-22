/**
 * @module FrankfurterFxRateProvider
 * @description Adapter del puerto `FxRateProvider` usando api.frankfurter.app
 * (ECB-backed, sin API key, sin rate limit estricto). Soporta todas las
 * monedas ISO 4217 que ECB cotiza.
 */
import type {
  Currency,
  ExchangeRate,
  RateHistoryPoint,
} from "~/contexts/fx/domain/entities/ExchangeRate.js";
import type { FxRateProvider } from "~/contexts/fx/domain/ports/FxProvider.js";
import { FxProviderUnavailableError } from "~/contexts/fx/domain/errors.js";

const FRANKFURTER_BASE = "https://api.frankfurter.app";

type FrankfurterLatestResponse = {
  date?: string;
  rates?: Record<string, number>;
};

type FrankfurterHistoryResponse = {
  rates?: Record<string, Record<string, number>>;
};

type FrankfurterCurrenciesResponse = Record<string, string>;

export class FrankfurterFxRateProvider implements FxRateProvider {
  supports(source: string, target: string): boolean {
    const s = source.toUpperCase();
    const t = target.toUpperCase();
    return /^[A-Z]{3}$/.test(s) && /^[A-Z]{3}$/.test(t);
  }

  async getRate(source: string, target: string): Promise<ExchangeRate> {
    const s = source.toUpperCase();
    const t = target.toUpperCase();
    if (s === t) {
      return {
        source: s,
        target: t,
        rate: 1,
        date: new Date().toISOString().slice(0, 10),
        dataSource: "frankfurter",
        fromCache: false,
      };
    }
    const url = `${FRANKFURTER_BASE}/latest?from=${encodeURIComponent(s)}&to=${encodeURIComponent(t)}`;
    let response: Response;
    try {
      response = await fetch(url);
    } catch (err) {
      throw new FxProviderUnavailableError(
        `Frankfurter no disponible: ${(err as Error).message}`,
      );
    }
    if (!response.ok) {
      throw new FxProviderUnavailableError(`Frankfurter HTTP ${response.status}`);
    }
    const data = (await response.json()) as FrankfurterLatestResponse;
    const rate = data.rates?.[t];
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
      throw new FxProviderUnavailableError("Frankfurter respuesta sin rate");
    }
    return {
      source: s,
      target: t,
      rate,
      date: data.date ?? new Date().toISOString().slice(0, 10),
      dataSource: "frankfurter",
      fromCache: false,
    };
  }

  async getRateHistory(
    source: string,
    target: string,
    startDate: string,
    endDate: string,
  ): Promise<RateHistoryPoint[]> {
    const s = source.toUpperCase();
    const t = target.toUpperCase();
    const url = `${FRANKFURTER_BASE}/${startDate}..${endDate}?from=${encodeURIComponent(s)}&to=${encodeURIComponent(t)}`;
    let response: Response;
    try {
      response = await fetch(url);
    } catch (err) {
      throw new FxProviderUnavailableError(
        `Frankfurter history no disponible: ${(err as Error).message}`,
      );
    }
    if (!response.ok) {
      throw new FxProviderUnavailableError(`Frankfurter history HTTP ${response.status}`);
    }
    const data = (await response.json()) as FrankfurterHistoryResponse;
    const rates = data.rates ?? {};
    return Object.entries(rates)
      .map<RateHistoryPoint | null>(([date, byTarget]) => {
        const rate = byTarget[t];
        if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
          return null;
        }
        return { date, rate, source: "frankfurter" };
      })
      .filter((x): x is RateHistoryPoint => x !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getSupportedCurrencies(): Promise<Currency[]> {
    let response: Response;
    try {
      response = await fetch(`${FRANKFURTER_BASE}/currencies`);
    } catch {
      return [];
    }
    if (!response.ok) return [];
    const data = (await response.json()) as FrankfurterCurrenciesResponse;
    return Object.entries(data).map(([code, name]) => ({
      code,
      name,
      symbol: code === "USD" || code === "MXN" ? "$" : code,
      supportsDecimals: true,
    }));
  }
}
