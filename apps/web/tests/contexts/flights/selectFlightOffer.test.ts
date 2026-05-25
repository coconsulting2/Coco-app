/**
 * Unit test del use-case `selectFlightOffer` con un stub del puerto
 * `FlightOfferRepository`. Verifica delegación 1:1 al repo.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("~/platform/logger/log/logger.js", () => ({
  Logger: () => ({ info() {}, warn() {}, error() {}, trace() {}, debug() {} }),
}));

import { selectFlightOffer } from "~/contexts/flights/application/selectFlightOffer.js";
import type { FlightOfferRepository } from "~/contexts/flights/domain/ports/FlightOfferRepository.js";
import type { SelectedFlightOffer } from "~/contexts/flights/domain/entities/FlightQuote.js";

const offer: SelectedFlightOffer = {
  id: "off-1",
  rawOfferId: "off-1",
  airlineName: "Demo",
  airlineIata: "DM",
  departureAt: "2026-06-01T08:00:00.000Z",
  arrivalAt: "2026-06-01T11:00:00.000Z",
  durationLabel: "3h 0m",
  stops: 0,
  totalAmount: 1000,
  totalCurrency: "MXN",
};

describe("selectFlightOffer", () => {
  it("persiste la oferta seleccionada vía el repo", async () => {
    const offerRepo: FlightOfferRepository = {
      saveSelectedOffer: vi.fn(async () => undefined),
    };

    await selectFlightOffer({ requestId: 42, offer }, { offerRepo });

    expect(offerRepo.saveSelectedOffer).toHaveBeenCalledWith(42, offer);
  });
});
