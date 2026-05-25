/**
 * @module ResilientHotelProvider
 * @description Adapter del puerto `HotelProvider`: intenta Duffel Stays y, si
 * la cuenta no lo tiene habilitado (403), cae al mock. Paridad con el legacy
 * `services/resilientHotelProvider.js`.
 */
import { isStaysAccessDeniedError } from "@coco/integrations/duffel";
import type {
  StaySearchInputApp,
  NormalizedStayOffer,
  EnrichedStayOffer,
} from "@coco/integrations/duffel";
import { DuffelStaysProvider } from "~/contexts/hotels/infrastructure/duffelStaysProvider.js";
import { MockHotelProvider } from "~/contexts/hotels/infrastructure/mockHotelProvider.js";
import type {
  HotelProvider,
  HotelProviderLabel,
  HotelSearchOffer,
} from "~/contexts/hotels/domain/ports/HotelProvider.js";
import { Logger } from "~/platform/logger/log/logger.js";

const log = Logger("hotels");

export class ResilientHotelProvider implements HotelProvider {
  private readonly duffel = new DuffelStaysProvider();
  private readonly mock = new MockHotelProvider();
  lastProviderUsed: HotelProviderLabel = "duffel";

  async searchOffers(params: StaySearchInputApp): Promise<HotelSearchOffer[]> {
    try {
      const offers = await this.duffel.searchOffers(params);
      this.lastProviderUsed = "duffel";
      return offers;
    } catch (err) {
      if (!isStaysAccessDeniedError(err)) {
        throw err;
      }
      log.warn(
        "[hotels] Duffel Stays no está habilitado en esta cuenta (403). Usando proveedor mock.",
      );
      const offers = await this.mock.searchOffers(params);
      this.lastProviderUsed = "mock_fallback";
      return offers.map((o) => ({ ...o, provider: "mock_fallback" as const }));
    }
  }

  /** Resuelve tarifas vía Duffel Stays (solo aplica con proveedor Duffel). */
  async fetchAllRates(
    searchResultId: string,
    baseOffer: NormalizedStayOffer,
  ): Promise<EnrichedStayOffer> {
    return this.duffel.fetchAllRates(searchResultId, baseOffer);
  }
}
