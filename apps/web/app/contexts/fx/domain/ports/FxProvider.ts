/**
 * @module FxProvider
 * @description Puerto del slice fx. Los adapters concretos
 * (`BanxicoFxRateProvider`, `FrankfurterFxRateProvider`) viven en
 * `infrastructure/`. El use-case llama estos métodos sin saber qué API
 * externa está detrás.
 */
import type {
  Currency,
  ExchangeRate,
  RateHistoryPoint,
} from "~/contexts/fx/domain/entities/ExchangeRate.js";

export interface FxRateProvider {
  /** Determina si el provider sabe convertir el par. */
  supports(source: string, target: string): boolean;

  /** Obtiene la cotización spot. Lanza si el provider está caído. */
  getRate(source: string, target: string): Promise<ExchangeRate>;

  /** Historial entre dos fechas (YYYY-MM-DD). Lanza si el provider está caído. */
  getRateHistory(
    source: string,
    target: string,
    startDate: string,
    endDate: string,
  ): Promise<RateHistoryPoint[]>;

  /** Lista de monedas soportadas. Devuelve [] si el provider no expone catálogo. */
  getSupportedCurrencies(): Promise<Currency[]>;
}

export interface FxRateCache {
  /** Lee la cotización cacheada para `date` (o hoy si null). */
  get(source: string, target: string, date?: string | null): Promise<ExchangeRate | null>;

  /** Persiste una cotización. */
  set(rate: ExchangeRate): Promise<void>;
}

export interface BanxicoFixingProvider {
  /** USD/MXN fixing FIX (SF43718) para fecha contable. Devuelve null si no disponible. */
  fetchUsdMxnFixing(isoDate: string): Promise<number | null>;
}

/** Compat con `domain/ports/FxProvider.ts` legacy (high-level API). */
export interface FxProvider {
  getRate(source: string, target: string): Promise<ExchangeRate>;
  convertAmount(amount: number, source: string, target: string): Promise<number>;
  supportedCurrencies(): Promise<Currency[]>;
}
