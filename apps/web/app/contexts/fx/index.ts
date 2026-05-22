/**
 * @module index
 * @description API pública del slice fx.
 */

export type { ExchangeRate } from "~/contexts/fx/domain/entities/ExchangeRate";
export type { FxProvider } from "~/contexts/fx/domain/ports/FxProvider";
export { FxError, FxProviderUnavailableError, UnsupportedCurrencyError } from "~/contexts/fx/domain/errors";

// @ts-ignore — JS module
export { getExchangeRate, convertCurrency, getSupportedCurrencies, getRateHistory } from "~/contexts/fx/application/exchangeRateService.js";
// @ts-ignore — JS module
export { getFxRateToTarget, convertAmount } from "~/contexts/fx/application/fxPublicService.js";
