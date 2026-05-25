/**
 * @module DuffelFlightProvider
 * @description Adapter del puerto `FlightProvider` que delega la búsqueda a
 * `@coco/integrations/duffel` (SDK Duffel tipado). No duplica lógica de SDK.
 */
import { searchFlightOffers } from "@coco/integrations/duffel";
import type {
  FlightSearchParams,
  NormalizedFlightOffer,
} from "@coco/integrations/duffel";
import type { FlightProvider } from "~/contexts/flights/domain/ports/FlightProvider.js";

export class DuffelFlightProvider implements FlightProvider {
  async searchOffers(
    params: FlightSearchParams,
  ): Promise<NormalizedFlightOffer[]> {
    return searchFlightOffers(params);
  }
}
