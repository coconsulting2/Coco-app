/**
 * @module fxOperations
 * @description Use-cases puros con DI del slice fx. Cache-first; cuando hay
 * miss usa Banxico para USD↔MXN, Frankfurter para el resto.
 */
import type {
  ConversionResult,
  Currency,
  ExchangeRate,
  RateHistoryPoint,
} from "~/contexts/fx/domain/entities/ExchangeRate.js";
import type {
  BanxicoFixingProvider,
  FxRateCache,
  FxRateProvider,
} from "~/contexts/fx/domain/ports/FxProvider.js";
import {
  FxProviderUnavailableError,
  UnsupportedCurrencyError,
} from "~/contexts/fx/domain/errors.js";

export type FxDeps = {
  banxico: FxRateProvider;
  frankfurter: FxRateProvider;
  cache: FxRateCache;
};

export type BanxicoFixingDeps = {
  banxicoFixing: BanxicoFixingProvider;
};

function validateCurrency(code: string): string {
  const norm = String(code ?? "").toUpperCase().trim();
  if (!/^[A-Z]{3}$/.test(norm)) {
    throw new UnsupportedCurrencyError(`Código de moneda inválido: ${code}`);
  }
  return norm;
}

function pickProvider(
  source: string,
  target: string,
  deps: FxDeps,
): FxRateProvider {
  if (deps.banxico.supports(source, target)) return deps.banxico;
  if (deps.frankfurter.supports(source, target)) return deps.frankfurter;
  throw new UnsupportedCurrencyError(
    `Ningún provider soporta ${source}→${target}`,
  );
}

export async function getExchangeRate(
  sourceRaw: string,
  targetRaw: string,
  deps: FxDeps,
): Promise<ExchangeRate> {
  const source = validateCurrency(sourceRaw);
  const target = validateCurrency(targetRaw);

  const cached = await deps.cache.get(source, target);
  if (cached) return cached;

  const provider = pickProvider(source, target, deps);
  let rate: ExchangeRate;
  try {
    rate = await provider.getRate(source, target);
  } catch (err) {
    if (err instanceof UnsupportedCurrencyError) throw err;
    // Fallback chain: if the primary provider fails and Frankfurter supports
    // it, try Frankfurter.
    if (provider !== deps.frankfurter && deps.frankfurter.supports(source, target)) {
      rate = await deps.frankfurter.getRate(source, target);
    } else {
      throw new FxProviderUnavailableError(
        `Sin cotización ${source}→${target}: ${(err as Error).message}`,
      );
    }
  }

  await deps.cache.set(rate);
  return rate;
}

export async function convertCurrency(
  amount: number,
  source: string,
  target: string,
  deps: FxDeps,
): Promise<ConversionResult> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("amount must be a positive number");
  }
  const rate = await getExchangeRate(source, target, deps);
  return {
    originalAmount: amount,
    originalCurrency: rate.source,
    convertedAmount: amount * rate.rate,
    targetCurrency: rate.target,
    exchangeRate: rate.rate,
    dataSource: rate.dataSource,
    rateDate: rate.date,
    fromCache: rate.fromCache,
  };
}

export async function getRateHistory(
  sourceRaw: string,
  targetRaw: string,
  startDate: string,
  endDate: string,
  deps: FxDeps,
): Promise<RateHistoryPoint[]> {
  const source = validateCurrency(sourceRaw);
  const target = validateCurrency(targetRaw);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    throw new Error("Dates must be YYYY-MM-DD");
  }
  if (startDate > endDate) throw new Error("startDate must be ≤ endDate");
  const provider = pickProvider(source, target, deps);
  return provider.getRateHistory(source, target, startDate, endDate);
}

export async function getSupportedCurrencies(deps: FxDeps): Promise<Currency[]> {
  // Frankfurter expone catálogo amplio; si falla, fallback al subset Banxico.
  try {
    const list = await deps.frankfurter.getSupportedCurrencies();
    if (list.length > 0) return list;
  } catch {
    /* ignore — fall through to banxico */
  }
  return deps.banxico.getSupportedCurrencies();
}

/** Conversión rápida (sin cache) que devuelve sólo la tasa. */
export async function getFxRateToTarget(
  fromRaw: string,
  toRaw: string,
  deps: FxDeps,
): Promise<number> {
  const from = validateCurrency(fromRaw);
  const to = validateCurrency(toRaw);
  if (from === to) return 1;
  const rate = await getExchangeRate(from, to, deps);
  return rate.rate;
}

/** Versión pública de convertCurrency con el shape que usaba fxPublicService.js. */
export async function convertAmount(
  from: string,
  to: string,
  amount: number,
  deps: FxDeps,
): Promise<{
  from: string;
  to: string;
  amount: number;
  rate: number;
  converted: number;
  rateDate: string;
  fromCache: boolean;
}> {
  const f = validateCurrency(from);
  const t = validateCurrency(to);
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt < 0) {
    throw new Error("amount must be a non-negative number");
  }
  const rate = await getExchangeRate(f, t, deps);
  return {
    from: f,
    to: t,
    amount: amt,
    rate: rate.rate,
    converted: amt * rate.rate,
    rateDate: rate.date,
    fromCache: rate.fromCache,
  };
}

/** Wrapper para el FIX Banxico FIX para asientos contables. */
export async function fetchBanxicoUsdMxnFixing(
  isoDate: string,
  deps: BanxicoFixingDeps,
): Promise<number | null> {
  return deps.banxicoFixing.fetchUsdMxnFixing(isoDate);
}
