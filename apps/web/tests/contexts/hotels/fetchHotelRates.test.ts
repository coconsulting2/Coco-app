/**
 * Unit tests del use-case `fetchHotelRates`. Verifica que sin proveedor de
 * tarifas lanza `HotelQuoteUnavailableError`, que delega al proveedor cuando
 * existe, y que el 403 de Stays se mapea a `StaysNotEnabledError`.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("~/platform/logger/log/logger.js", () => ({
  Logger: () => ({ info() {}, warn() {}, error() {}, trace() {}, debug() {} }),
}));

import {
  fetchHotelRates,
  type RatesProvider,
} from "~/contexts/hotels/application/fetchHotelRates.js";
import {
  HotelQuoteUnavailableError,
  StaysNotEnabledError,
} from "~/contexts/hotels/domain/errors.js";
import type {
  NormalizedStayOffer,
  EnrichedStayOffer,
} from "@coco/integrations/duffel";

const baseOffer: NormalizedStayOffer = {
  id: "srr_1",
  rawOfferId: "srr_1",
  searchResultId: "srr_1",
  accommodationId: "acc_1",
  hotelName: "Hotel Demo",
  addressHint: "Centro",
  checkIn: "2026-06-01",
  checkOut: "2026-06-03",
  nights: 2,
  totalAmount: 2000,
  totalCurrency: "MXN",
  stars: 4,
  provider: "duffel_stays",
};

const enriched: EnrichedStayOffer = {
  ...baseOffer,
  rates: [
    {
      rateId: "rate_1",
      roomName: "Standard",
      rateName: "Flexible",
      totalAmount: 1900,
      totalCurrency: "MXN",
      boardType: "room_only",
    },
  ],
  ratesFetched: true,
};

const input = { searchResultId: "srr_1", baseOffer };

describe("fetchHotelRates", () => {
  it("lanza HotelQuoteUnavailableError sin proveedor de tarifas", async () => {
    await expect(
      fetchHotelRates(input, { ratesProvider: null }),
    ).rejects.toBeInstanceOf(HotelQuoteUnavailableError);
  });

  it("delega al proveedor y devuelve la oferta enriquecida", async () => {
    const ratesProvider: RatesProvider = {
      fetchAllRates: vi.fn(async () => enriched),
    };

    const result = await fetchHotelRates(input, { ratesProvider });

    expect(ratesProvider.fetchAllRates).toHaveBeenCalledWith("srr_1", baseOffer);
    expect(result).toEqual({ offer: enriched, provider: "duffel" });
  });

  it("mapea el 403 de Stays a StaysNotEnabledError", async () => {
    const ratesProvider: RatesProvider = {
      fetchAllRates: vi.fn(async () => {
        throw Object.assign(new Error("not enabled"), { status: 403 });
      }),
    };

    await expect(
      fetchHotelRates(input, { ratesProvider }),
    ).rejects.toBeInstanceOf(StaysNotEnabledError);
  });
});
