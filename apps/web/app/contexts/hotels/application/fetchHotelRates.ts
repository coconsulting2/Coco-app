/**
 * @module fetchHotelRates
 * @description Use-case con DI: resuelve las tarifas (cuartos) de un resultado
 * de búsqueda de Duffel Stays y enriquece la oferta base. Paridad con el
 * legacy `postHotelFetchRates`.
 */
import { isStaysAccessDeniedError } from "@coco/integrations/duffel";
import type {
  NormalizedStayOffer,
  EnrichedStayOffer,
} from "@coco/integrations/duffel";
import {
  HotelQuoteUnavailableError,
  StaysNotEnabledError,
} from "~/contexts/hotels/domain/errors.js";

/** Proveedor capaz de resolver tarifas (solo Duffel Stays). */
export interface RatesProvider {
  fetchAllRates(
    searchResultId: string,
    baseOffer: NormalizedStayOffer,
  ): Promise<EnrichedStayOffer>;
}

export type FetchHotelRatesInput = {
  searchResultId: string;
  baseOffer: NormalizedStayOffer;
};

export type FetchHotelRatesDeps = {
  /** Proveedor de tarifas (Duffel) o `null` si el proveedor activo no las soporta. */
  ratesProvider: RatesProvider | null;
  logger?: { error(msg: string): void };
};

export type FetchHotelRatesResult = {
  offer: EnrichedStayOffer;
  provider: "duffel";
};

export async function fetchHotelRates(
  input: FetchHotelRatesInput,
  deps: FetchHotelRatesDeps,
): Promise<FetchHotelRatesResult> {
  if (!deps.ratesProvider) {
    throw new HotelQuoteUnavailableError(
      "fetch_all_rates solo aplica con proveedor Duffel Stays.",
    );
  }

  try {
    const offer = await deps.ratesProvider.fetchAllRates(
      input.searchResultId,
      input.baseOffer,
    );
    return { offer, provider: "duffel" };
  } catch (err) {
    deps.logger?.error(
      `[hotels/fetch-rates] ${(err as Error)?.message ?? String(err)}`,
    );
    if (isStaysAccessDeniedError(err)) {
      throw new StaysNotEnabledError();
    }
    throw err;
  }
}
