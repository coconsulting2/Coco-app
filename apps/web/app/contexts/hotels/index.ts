/**
 * @module hotels (slice public API + composition root)
 * @description Fachada estable del slice hotels. La búsqueda y enrichment
 * delegan a `@coco/integrations/duffel`; la persistencia de la oferta
 * seleccionada vive aquí.
 */

// ── Domain types + errores ────────────────────────────────────────────────
export type {
  StayOffer,
  EnrichedStay,
  SelectedHotelOffer,
  StaySearchInput,
  HotelQuote,
} from "~/contexts/hotels/domain/entities/HotelQuote.js";
export type { HotelProvider } from "~/contexts/hotels/domain/ports/HotelProvider.js";
export type { StayOfferRepository } from "~/contexts/hotels/domain/ports/StayOfferRepository.js";

export {
  HotelsError,
  HotelSearchError,
  HotelQuoteUnavailableError,
  InvalidStayDatesError,
  StaysNotEnabledError,
} from "~/contexts/hotels/domain/errors.js";

// ── Re-exports de @coco/integrations.duffel (búsqueda + enrichment) ──────
export {
  searchStays,
  staysFetchAllRates,
  enrichOfferFromFetchAllRates,
  isStaysAccessDeniedError,
  type NormalizedStayOffer,
  type EnrichedStayOffer,
  type StaySearchInputApp,
} from "@coco/integrations/duffel";

// ── Composition root (default deps) ───────────────────────────────────────
import { PrismaStayOfferRepository } from "~/contexts/hotels/infrastructure/PrismaStayOfferRepository.js";
import {
  getHotelProvider,
  getActiveHotelProviderLabel,
  supportsFetchRates,
} from "~/contexts/hotels/infrastructure/hotelProvider.js";
import { Logger } from "~/platform/logger/log/logger.js";
import * as selectStayOfferModule from "~/contexts/hotels/application/selectStayOffer.js";
import * as searchHotelsModule from "~/contexts/hotels/application/searchHotels.js";
import * as fetchHotelRatesModule from "~/contexts/hotels/application/fetchHotelRates.js";

const defaultStayOfferRepo = new PrismaStayOfferRepository();

export const selectStayOffer = (
  input: selectStayOfferModule.SelectStayOfferInput,
) =>
  selectStayOfferModule.selectStayOffer(input, {
    offerRepo: defaultStayOfferRepo,
  });

/** Busca hospedaje con el proveedor configurado (`HOTEL_PROVIDER`). */
export const searchHotels = (input: searchHotelsModule.SearchHotelsInput) =>
  searchHotelsModule.searchHotels(input, {
    provider: getHotelProvider(),
    resolveLabel: getActiveHotelProviderLabel,
    logger: Logger("hotels"),
  });

/** Resuelve tarifas de un resultado de búsqueda Duffel Stays. */
export const fetchHotelRates = (
  input: fetchHotelRatesModule.FetchHotelRatesInput,
) => {
  const provider = getHotelProvider();
  return fetchHotelRatesModule.fetchHotelRates(input, {
    ratesProvider: supportsFetchRates(provider) ? provider : null,
    logger: Logger("hotels"),
  });
};

export const usecases = {
  selectStayOffer: selectStayOfferModule.selectStayOffer,
  searchHotels: searchHotelsModule.searchHotels,
  fetchHotelRates: fetchHotelRatesModule.fetchHotelRates,
} as const;

export const adapters = {
  StayOfferRepository: PrismaStayOfferRepository,
} as const;
