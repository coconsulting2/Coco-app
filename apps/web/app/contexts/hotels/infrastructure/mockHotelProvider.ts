/**
 * @module MockHotelProvider
 * @description Adapter del puerto `HotelProvider` con ofertas estáticas
 * (solo con `HOTEL_PROVIDER=mock`, sin Duffel). Paridad con el legacy
 * `services/mockHotelProvider.js`.
 */
import type { NormalizedStayOffer } from "@coco/integrations/duffel";
import type {
  HotelProvider,
  HotelProviderLabel,
  StaySearchInputApp,
} from "~/contexts/hotels/domain/ports/HotelProvider.js";

/** Oferta de hospedaje mock: misma forma que la normalizada salvo `provider`. */
export type MockStayOffer = Omit<NormalizedStayOffer, "provider"> & {
  provider: "mock" | "mock_fallback";
};

export class MockHotelProvider implements HotelProvider {
  readonly lastProviderUsed: HotelProviderLabel = "mock";

  async searchOffers(params: StaySearchInputApp): Promise<MockStayOffer[]> {
    const city = String(params.ciudad || "CDMX").trim() || "CDMX";
    const checkIn = String(params.fechaEntrada || "2026-06-01");
    const checkOut = String(params.fechaSalida || "2026-06-03");
    const guests = Math.max(1, Math.min(9, Number(params.huespedes) || 1));

    const inD = new Date(`${checkIn}T12:00:00Z`);
    const outD = new Date(`${checkOut}T12:00:00Z`);
    const nights = Math.max(
      1,
      Math.round((outD.getTime() - inD.getTime()) / (24 * 60 * 60 * 1000)) || 1,
    );

    const base = 1200 * nights * guests;

    return [
      {
        id: `mock-hotel-001-${city}`,
        rawOfferId: `mock-hotel-001-${city}`,
        searchResultId: `mock-hotel-001-${city}`,
        accommodationId: null,
        hotelName: `Hotel Sandbox ${city}`,
        addressHint: `Zona centro · ${city}`,
        checkIn,
        checkOut,
        nights,
        totalAmount: Math.round(base * 1.05),
        totalCurrency: "MXN",
        stars: 4,
        provider: "mock",
      },
      {
        id: `mock-hotel-002-${city}`,
        rawOfferId: `mock-hotel-002-${city}`,
        searchResultId: `mock-hotel-002-${city}`,
        accommodationId: null,
        hotelName: "CocoStay Demo",
        addressHint: `Cerca de avenida principal · ${city}`,
        checkIn,
        checkOut,
        nights,
        totalAmount: Math.round(base * 0.92),
        totalCurrency: "MXN",
        stars: 3,
        provider: "mock",
      },
      {
        id: `mock-hotel-003-${city}`,
        rawOfferId: `mock-hotel-003-${city}`,
        searchResultId: `mock-hotel-003-${city}`,
        accommodationId: null,
        hotelName: "Business Inn Express",
        addressHint: `Distrito financiero · ${city}`,
        checkIn,
        checkOut,
        nights,
        totalAmount: Math.round(base * 1.28),
        totalCurrency: "MXN",
        stars: 5,
        provider: "mock",
      },
    ];
  }
}
