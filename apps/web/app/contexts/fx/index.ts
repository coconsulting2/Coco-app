/**
 * @module fx (slice public API + composition root)
 * @description Hexagonal proper: ports en domain/, adapters en infrastructure/
 * (Banxico SF43718 + Frankfurter ECB + Mongo cache), use-cases con DI en
 * application/fxOperations.ts.
 */

// ── Domain types + errores ────────────────────────────────────────────────
export type {
  ExchangeRate,
  Currency,
  RateHistoryPoint,
  ConversionResult,
} from "~/contexts/fx/domain/entities/ExchangeRate.js";

export type {
  FxRateProvider,
  FxRateCache,
  BanxicoFixingProvider,
  FxProvider,
} from "~/contexts/fx/domain/ports/FxProvider.js";

export {
  FxError,
  FxProviderUnavailableError,
  UnsupportedCurrencyError,
} from "~/contexts/fx/domain/errors.js";

// ── Composition root (default deps) ───────────────────────────────────────
import { BanxicoFxRateProvider } from "~/contexts/fx/infrastructure/BanxicoFxRateProvider.js";
import { FrankfurterFxRateProvider } from "~/contexts/fx/infrastructure/FrankfurterFxRateProvider.js";
import { MongoFxRateCache } from "~/contexts/fx/infrastructure/MongoFxRateCache.js";
import * as fxOps from "~/contexts/fx/application/fxOperations.js";

const defaultBanxico = new BanxicoFxRateProvider();
const defaultFrankfurter = new FrankfurterFxRateProvider();
const defaultCache = new MongoFxRateCache();
const defaultDeps: fxOps.FxDeps = {
  banxico: defaultBanxico,
  frankfurter: defaultFrankfurter,
  cache: defaultCache,
};

// ── Use-cases pre-wired ───────────────────────────────────────────────────

export const getExchangeRate = (source: string, target: string) =>
  fxOps.getExchangeRate(source, target, defaultDeps);

export const convertCurrency = (amount: number, source: string, target: string) =>
  fxOps.convertCurrency(amount, source, target, defaultDeps);

export const getRateHistory = (
  source: string,
  target: string,
  startDate: string,
  endDate: string,
) => fxOps.getRateHistory(source, target, startDate, endDate, defaultDeps);

export const getSupportedCurrencies = () => fxOps.getSupportedCurrencies(defaultDeps);

export const getFxRateToTarget = (from: string, to: string) =>
  fxOps.getFxRateToTarget(from, to, defaultDeps);

export const convertAmount = (from: string, to: string, amount: number) =>
  fxOps.convertAmount(from, to, amount, defaultDeps);

export const fetchBanxicoUsdMxnFixing = (isoDate: string) =>
  fxOps.fetchBanxicoUsdMxnFixing(isoDate, { banxicoFixing: defaultBanxico });

// ── Raw use-cases ─────────────────────────────────────────────────────────
export const usecases = {
  getExchangeRate: fxOps.getExchangeRate,
  convertCurrency: fxOps.convertCurrency,
  getRateHistory: fxOps.getRateHistory,
  getSupportedCurrencies: fxOps.getSupportedCurrencies,
  getFxRateToTarget: fxOps.getFxRateToTarget,
  convertAmount: fxOps.convertAmount,
  fetchBanxicoUsdMxnFixing: fxOps.fetchBanxicoUsdMxnFixing,
} as const;

export const adapters = {
  BanxicoFxRateProvider,
  FrankfurterFxRateProvider,
  MongoFxRateCache,
} as const;
