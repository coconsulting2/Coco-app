/**
 * @module FlightProvider
 * @description Puerto del slice flights. Un adapter concreto sabe buscar
 * ofertas de vuelo (Duffel o mock). Los adapters viven en `infrastructure/`.
 */
import type {
  FlightSearchParams,
  NormalizedFlightOffer,
} from "@coco/integrations/duffel";

export type { FlightSearchParams, NormalizedFlightOffer };

export interface FlightProvider {
  /** Busca ofertas normalizadas para los parámetros dados. */
  searchOffers(params: FlightSearchParams): Promise<NormalizedFlightOffer[]>;
}
