/**
 * Unit tests del use-case `getExchangeRate` (slice fx) con stubs in-memory de
 * los ports FxRateProvider (banxico/frankfurter) y FxRateCache. Cubre:
 * cache-hit, cache-miss + selección de provider + escritura en cache, fallback
 * a Frankfurter cuando el primario falla, validación de moneda y error cuando
 * ningún provider soporta el par.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("~/platform/logger/log/logger.js", () => ({
  Logger: () => ({ info() {}, warn() {}, error() {}, trace() {}, debug() {} }),
}));

import { getExchangeRate } from "~/contexts/fx/application/fxOperations.js";
import type { FxDeps } from "~/contexts/fx/application/fxOperations.js";
import type {
  FxRateProvider,
  FxRateCache,
} from "~/contexts/fx/domain/ports/FxProvider.js";
import type { ExchangeRate } from "~/contexts/fx/domain/entities/ExchangeRate.js";
import {
  FxProviderUnavailableError,
  UnsupportedCurrencyError,
} from "~/contexts/fx/domain/errors.js";

function rate(over: Partial<ExchangeRate> = {}): ExchangeRate {
  return {
    source: "USD",
    target: "MXN",
    rate: 20,
    date: "2026-05-25",
    dataSource: "banxico",
    fromCache: false,
    ...over,
  };
}

function makeProvider(
  supportsPair: boolean,
  getRateImpl?: () => Promise<ExchangeRate>,
): FxRateProvider {
  return {
    supports: vi.fn(() => supportsPair),
    getRate: vi.fn(getRateImpl ?? (async () => rate())),
    getRateHistory: vi.fn(async () => []),
    getSupportedCurrencies: vi.fn(async () => []),
  };
}

function makeCache(cached: ExchangeRate | null): FxRateCache {
  return {
    get: vi.fn(async () => cached),
    set: vi.fn(async () => undefined),
  };
}

describe("getExchangeRate", () => {
  it("devuelve la tasa cacheada sin consultar providers (cache-hit)", async () => {
    const banxico = makeProvider(true);
    const cache = makeCache(rate({ dataSource: "cache", fromCache: true }));
    const deps: FxDeps = { banxico, frankfurter: makeProvider(false), cache };

    const result = await getExchangeRate("usd", "mxn", deps);

    expect(result.fromCache).toBe(true);
    expect(banxico.getRate).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it("consulta Banxico en cache-miss y persiste la tasa", async () => {
    const banxico = makeProvider(true, async () => rate());
    const cache = makeCache(null);
    const deps: FxDeps = { banxico, frankfurter: makeProvider(false), cache };

    const result = await getExchangeRate("USD", "MXN", deps);

    expect(result.rate).toBe(20);
    expect(banxico.getRate).toHaveBeenCalledWith("USD", "MXN");
    expect(cache.set).toHaveBeenCalledWith(result);
  });

  it("usa Frankfurter cuando Banxico no soporta el par", async () => {
    const banxico = makeProvider(false);
    const frankfurter = makeProvider(true, async () =>
      rate({ source: "EUR", target: "GBP", rate: 0.85, dataSource: "frankfurter" }),
    );
    const deps: FxDeps = { banxico, frankfurter, cache: makeCache(null) };

    const result = await getExchangeRate("EUR", "GBP", deps);

    expect(result.dataSource).toBe("frankfurter");
    expect(frankfurter.getRate).toHaveBeenCalled();
  });

  it("cae a Frankfurter cuando el provider primario falla", async () => {
    const banxico = makeProvider(true, async () => {
      throw new Error("banxico down");
    });
    // Frankfurter soporta el par y resuelve.
    const frankfurter = makeProvider(true, async () =>
      rate({ dataSource: "frankfurter" }),
    );
    const deps: FxDeps = { banxico, frankfurter, cache: makeCache(null) };

    const result = await getExchangeRate("USD", "MXN", deps);

    expect(result.dataSource).toBe("frankfurter");
    expect(frankfurter.getRate).toHaveBeenCalled();
  });

  it("lanza FxProviderUnavailableError si el primario falla y no hay fallback", async () => {
    const banxico = makeProvider(true, async () => {
      throw new Error("banxico down");
    });
    const frankfurter = makeProvider(false);
    const deps: FxDeps = { banxico, frankfurter, cache: makeCache(null) };

    await expect(getExchangeRate("USD", "MXN", deps)).rejects.toBeInstanceOf(
      FxProviderUnavailableError,
    );
  });

  it("lanza UnsupportedCurrencyError ante un código inválido", async () => {
    const deps: FxDeps = {
      banxico: makeProvider(false),
      frankfurter: makeProvider(false),
      cache: makeCache(null),
    };
    await expect(getExchangeRate("US", "MXN", deps)).rejects.toBeInstanceOf(
      UnsupportedCurrencyError,
    );
  });

  it("lanza UnsupportedCurrencyError si ningún provider soporta el par", async () => {
    const deps: FxDeps = {
      banxico: makeProvider(false),
      frankfurter: makeProvider(false),
      cache: makeCache(null),
    };
    await expect(getExchangeRate("USD", "JPY", deps)).rejects.toBeInstanceOf(
      UnsupportedCurrencyError,
    );
  });
});
