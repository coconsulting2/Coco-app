/**
 * Unit tests del use-case `searchFlights` con stubs de los puertos
 * `FlightProvider`. Verifica delegación, etiqueta del proveedor y la lógica
 * de fallback a mock cuando Duffel falla (paridad con `postFlightSearch`).
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("~/platform/logger/log/logger.js", () => ({
  Logger: () => ({ info() {}, warn() {}, error() {}, trace() {}, debug() {} }),
}));

import { searchFlights } from "~/contexts/flights/application/searchFlights.js";
import type { FlightProvider } from "~/contexts/flights/domain/ports/FlightProvider.js";
import type { NormalizedFlightOffer } from "@coco/integrations/duffel";

function makeOffer(over: Partial<NormalizedFlightOffer> = {}): NormalizedFlightOffer {
  return {
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
    ...over,
  };
}

function makeProvider(impl: () => Promise<NormalizedFlightOffer[]>): FlightProvider {
  return { searchOffers: vi.fn(impl) };
}

const input = {
  origin: "MEX",
  destination: "CUN",
  departureDate: "2026-06-01",
  passengers: 1,
};

describe("searchFlights", () => {
  it("delega al proveedor y devuelve offers + etiqueta", async () => {
    const offers = [makeOffer()];
    const provider = makeProvider(async () => offers);
    const mockProvider = makeProvider(async () => []);

    const result = await searchFlights(input, {
      provider,
      providerLabel: "duffel",
      mockProvider,
    });

    expect(provider.searchOffers).toHaveBeenCalledWith(input);
    expect(result).toEqual({ offers, provider: "duffel" });
    expect(mockProvider.searchOffers).not.toHaveBeenCalled();
  });

  it("cae al mock cuando Duffel falla y marca fallback", async () => {
    const mockOffers = [makeOffer({ id: "mock-1", rawOfferId: "mock-1" })];
    const provider = makeProvider(async () => {
      throw new Error("duffel down");
    });
    const mockProvider = makeProvider(async () => mockOffers);

    const result = await searchFlights(input, {
      provider,
      providerLabel: "duffel",
      mockProvider,
    });

    expect(result).toEqual({ offers: mockOffers, provider: "mock", fallback: true });
    expect(mockProvider.searchOffers).toHaveBeenCalledWith(input);
  });

  it("propaga el error cuando el proveedor activo es mock (sin fallback)", async () => {
    const provider = makeProvider(async () => {
      throw new Error("mock down");
    });
    const mockProvider = makeProvider(async () => []);

    await expect(
      searchFlights(input, { provider, providerLabel: "mock", mockProvider }),
    ).rejects.toThrow("mock down");
    expect(mockProvider.searchOffers).not.toHaveBeenCalled();
  });
});
