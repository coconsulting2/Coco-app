/**
 * @module ExchangeRate
 * @description Entidades de dominio del slice fx.
 */

export type ExchangeRate = {
  source: string;
  target: string;
  rate: number;
  /** Día en ISO YYYY-MM-DD. */
  date: string;
  dataSource: "banxico" | "frankfurter" | "cache" | "unknown";
  fromCache: boolean;
};

export type Currency = {
  code: string;
  name: string;
  symbol: string;
  supportsDecimals: boolean;
};

export type RateHistoryPoint = {
  date: string;
  rate: number;
  source: "banxico" | "frankfurter" | "unknown";
};

export type ConversionResult = {
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  targetCurrency: string;
  exchangeRate: number;
  dataSource: string;
  rateDate: string;
  fromCache: boolean;
};
