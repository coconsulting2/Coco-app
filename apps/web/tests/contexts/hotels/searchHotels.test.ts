/**
 * Unit tests del use-case `searchHotels`. Stubea el puerto `HotelProvider` y
 * verifica validación de fechas, delegación, etiqueta y el mapeo del 403 de
 * Duffel Stays a `StaysNotEnabledError` (paridad con `postHotelSearch`).
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("~/platform/logger/log/logger.js", () => ({
  Logger: () => ({ info() {}, warn() {}, error() {}, trace() {}, debug() {} }),
}));

import { searchHotels } from "~/contexts/hotels/application/searchHotels.js";
import {
  InvalidStayDatesError,
  StaysNotEnabledError,
} from "~/contexts/hotels/domain/errors.js";
import type {
  HotelProvider,
  HotelProviderLabel,
  HotelSearchOffer,
} from "~/contexts/hotels/domain/ports/HotelProvider.js";

function makeOffer(over: Partial<HotelSearchOffer> = {}): HotelSearchOffer {
  return {
    id: "h-1",
    rawOfferId: "h-1",
    searchResultId: "srr_1",
    accommodationId: null,
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

function makeProvider(
  impl: () => Promise<HotelSearchOffer[]>,
  label: HotelProviderLabel = "duffel",
): HotelProvider {
  return { searchOffers: vi.fn(impl), lastProviderUsed: label };
}

const input = {
  ciudad: "CDMX",
  fechaEntrada: "2026-06-01",
  fechaSalida: "2026-06-03",
  huespedes: 2,
};

describe("searchHotels", () => {
  it("rechaza cuando fecha_salida no es posterior a fecha_entrada", async () => {
    const provider = makeProvider(async () => []);
    await expect(
      searchHotels(
        { ...input, fechaSalida: input.fechaEntrada },
        { provider, resolveLabel: () => "duffel" },
      ),
    ).rejects.toBeInstanceOf(InvalidStayDatesError);
    expect(provider.searchOffers).not.toHaveBeenCalled();
  });

  it("delega al proveedor y devuelve offers + etiqueta resuelta", async () => {
    const offers = [makeOffer()];
    const provider = makeProvider(async () => offers);

    const result = await searchHotels(input, {
      provider,
      resolveLabel: (p) => p.lastProviderUsed,
    });

    expect(provider.searchOffers).toHaveBeenCalledWith(input);
    expect(result).toEqual({ offers, provider: "duffel" });
  });

  it("mapea un 403 de Stays a StaysNotEnabledError (503)", async () => {
    const denied = Object.assign(new Error("not enabled"), { status: 403 });
    const provider = makeProvider(async () => {
      throw denied;
    });

    await expect(
      searchHotels(input, { provider, resolveLabel: () => "duffel" }),
    ).rejects.toBeInstanceOf(StaysNotEnabledError);
  });

  it("propaga errores no relacionados con Stays", async () => {
    const provider = makeProvider(async () => {
      throw new Error("boom");
    });
    await expect(
      searchHotels(input, { provider, resolveLabel: () => "duffel" }),
    ).rejects.toThrow("boom");
  });
});
