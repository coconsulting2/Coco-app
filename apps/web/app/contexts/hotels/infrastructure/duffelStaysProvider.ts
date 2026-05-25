/**
 * @module DuffelStaysProvider
 * @description Adapter del puerto `HotelProvider` que delega la búsqueda y el
 * enrichment a `@coco/integrations/duffel` (Duffel Stays tipado). No duplica
 * lógica de SDK / HTTP.
 */
import {
  searchStays,
  staysFetchAllRates,
  enrichOfferFromFetchAllRates,
} from "@coco/integrations/duffel";
import type {
  StaySearchInputApp,
  NormalizedStayOffer,
  EnrichedStayOffer,
} from "@coco/integrations/duffel";
import type {
  HotelProvider,
  HotelProviderLabel,
  HotelSearchOffer,
} from "~/contexts/hotels/domain/ports/HotelProvider.js";

export class DuffelStaysProvider implements HotelProvider {
  readonly lastProviderUsed: HotelProviderLabel = "duffel";

  async searchOffers(params: StaySearchInputApp): Promise<HotelSearchOffer[]> {
    return searchStays(params);
  }

  /** Resuelve las tarifas (cuartos) para un search result y enriquece la oferta. */
  async fetchAllRates(
    searchResultId: string,
    baseOffer: NormalizedStayOffer,
  ): Promise<EnrichedStayOffer> {
    const response = await staysFetchAllRates(searchResultId);
    return enrichOfferFromFetchAllRates(
      response.data as Parameters<typeof enrichOfferFromFetchAllRates>[0],
      baseOffer,
    );
  }
}
