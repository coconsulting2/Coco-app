/**
 * Unit tests del use-case `selectStayOffer`. Mockea `@coco/integrations/duffel`
 * para verificar que: con ofertas Duffel Stays (srr_*) se resuelven rates y se
 * persiste la oferta enriquecida; con ofertas no-Duffel se persiste tal cual;
 * y que un fallo de fetch_all_rates degrada a guardar la oferta resumida.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("~/platform/logger/log/logger.js", () => ({
  Logger: () => ({ info() {}, warn() {}, error() {}, trace() {}, debug() {} }),
}));

const staysFetchAllRates = vi.fn();
const enrichOfferFromFetchAllRates = vi.fn();

vi.mock("@coco/integrations/duffel", () => ({
  staysFetchAllRates: (...args: unknown[]) => staysFetchAllRates(...args),
  enrichOfferFromFetchAllRates: (...args: unknown[]) =>
    enrichOfferFromFetchAllRates(...args),
}));

import { selectStayOffer } from "~/contexts/hotels/application/selectStayOffer.js";
import type { StayOfferRepository } from "~/contexts/hotels/domain/ports/StayOfferRepository.js";
import type { StayOffer } from "~/contexts/hotels/domain/entities/HotelQuote.js";

function makeOffer(over: Partial<StayOffer> = {}): StayOffer {
  return {
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
    ...over,
  };
}

beforeEach(() => {
  staysFetchAllRates.mockReset();
  enrichOfferFromFetchAllRates.mockReset();
});

describe("selectStayOffer", () => {
  it("resuelve rates y persiste la oferta enriquecida para Duffel Stays", async () => {
    const offer = makeOffer();
    const enriched = { ...offer, rates: [], ratesFetched: true };
    staysFetchAllRates.mockResolvedValue({ data: { accommodation: {} } });
    enrichOfferFromFetchAllRates.mockReturnValue(enriched);

    const offerRepo: StayOfferRepository = {
      saveSelectedOffer: vi.fn(async () => undefined),
    };

    const result = await selectStayOffer({ requestId: 7, offer }, { offerRepo });

    expect(staysFetchAllRates).toHaveBeenCalledWith("srr_1");
    expect(offerRepo.saveSelectedOffer).toHaveBeenCalledWith(7, enriched);
    expect(result.saved).toEqual(enriched);
  });

  it("persiste tal cual una oferta que no es Duffel Stays", async () => {
    const offer = makeOffer({ id: "mock-1", searchResultId: "mock-1" });
    const offerRepo: StayOfferRepository = {
      saveSelectedOffer: vi.fn(async () => undefined),
    };

    const result = await selectStayOffer({ requestId: 8, offer }, { offerRepo });

    expect(staysFetchAllRates).not.toHaveBeenCalled();
    expect(offerRepo.saveSelectedOffer).toHaveBeenCalledWith(8, offer);
    expect(result.saved).toEqual(offer);
  });

  it("degrada a la oferta resumida si fetch_all_rates falla", async () => {
    const offer = makeOffer();
    staysFetchAllRates.mockRejectedValue(new Error("rates down"));

    const offerRepo: StayOfferRepository = {
      saveSelectedOffer: vi.fn(async () => undefined),
    };

    const result = await selectStayOffer({ requestId: 9, offer }, { offerRepo });

    expect(offerRepo.saveSelectedOffer).toHaveBeenCalledWith(9, offer);
    expect(result.saved).toEqual(offer);
  });
});
