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
import * as selectStayOfferModule from "~/contexts/hotels/application/selectStayOffer.js";

const defaultStayOfferRepo = new PrismaStayOfferRepository();

export const selectStayOffer = (
  input: selectStayOfferModule.SelectStayOfferInput,
) =>
  selectStayOfferModule.selectStayOffer(input, {
    offerRepo: defaultStayOfferRepo,
  });

export const usecases = {
  selectStayOffer: selectStayOfferModule.selectStayOffer,
} as const;

export const adapters = {
  StayOfferRepository: PrismaStayOfferRepository,
} as const;
