/**
 * @module flights (slice public API + composition root)
 * @description Fachada estable del slice flights. Las búsquedas de ofertas
 * delegan a `@coco/integrations/duffel`; la persistencia de la oferta
 * seleccionada vive aquí (port + adapter Prisma).
 */

// ── Domain types + errores ────────────────────────────────────────────────
export type {
  FlightOffer,
  SelectedFlightOffer,
  FlightSearchInput,
  FlightQuote,
} from "~/contexts/flights/domain/entities/FlightQuote.js";
export type { FlightProvider } from "~/contexts/flights/domain/ports/FlightProvider.js";
export type { FlightOfferRepository } from "~/contexts/flights/domain/ports/FlightOfferRepository.js";

export {
  FlightsError,
  FlightSearchError,
  QuoteExpiredError,
} from "~/contexts/flights/domain/errors.js";

// ── Re-exports de @coco/integrations.duffel (búsqueda) ───────────────────
export {
  searchFlightOffers,
  type NormalizedFlightOffer,
  type FlightSearchParams,
} from "@coco/integrations/duffel";

// ── Composition root (default deps) ───────────────────────────────────────
import { PrismaFlightOfferRepository } from "~/contexts/flights/infrastructure/PrismaFlightOfferRepository.js";
import {
  getFlightProvider,
  resolveFlightProviderMode,
} from "~/contexts/flights/infrastructure/flightProvider.js";
import { MockFlightProvider } from "~/contexts/flights/infrastructure/mockFlightProvider.js";
import { Logger } from "~/platform/logger/log/logger.js";
import * as selectFlightOfferModule from "~/contexts/flights/application/selectFlightOffer.js";
import * as searchFlightsModule from "~/contexts/flights/application/searchFlights.js";

const defaultOfferRepo = new PrismaFlightOfferRepository();

export const selectFlightOffer = (
  input: selectFlightOfferModule.SelectFlightOfferInput,
) =>
  selectFlightOfferModule.selectFlightOffer(input, {
    offerRepo: defaultOfferRepo,
  });

/** Busca ofertas de vuelo con el proveedor configurado (`FLIGHT_PROVIDER`). */
export const searchFlights = (input: searchFlightsModule.SearchFlightsInput) =>
  searchFlightsModule.searchFlights(input, {
    provider: getFlightProvider(),
    providerLabel: resolveFlightProviderMode(),
    mockProvider: new MockFlightProvider(),
    logger: Logger("flights"),
  });

// ── Raw use-cases (tests + composiciones custom) ─────────────────────────
export const usecases = {
  selectFlightOffer: selectFlightOfferModule.selectFlightOffer,
  searchFlights: searchFlightsModule.searchFlights,
} as const;

export const adapters = {
  FlightOfferRepository: PrismaFlightOfferRepository,
} as const;
