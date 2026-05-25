/**
 * @module hotelProvider
 * @description Selección del adapter de hospedaje según `HOTEL_PROVIDER`
 * (o herencia de `FLIGHT_PROVIDER`). Paridad con el legacy
 * `services/hotelProvider.js`.
 *
 * - HOTEL_PROVIDER=mock        → siempre mock.
 * - HOTEL_PROVIDER=duffel      → Duffel resiliente (cae a mock si 403).
 * - sin HOTEL_PROVIDER         → Duffel resiliente si FLIGHT_PROVIDER=duffel; mock en otro caso.
 */
import { MockHotelProvider } from "~/contexts/hotels/infrastructure/mockHotelProvider.js";
import { ResilientHotelProvider } from "~/contexts/hotels/infrastructure/resilientHotelProvider.js";
import type {
  HotelProvider,
  HotelProviderLabel,
} from "~/contexts/hotels/domain/ports/HotelProvider.js";

export function getHotelProvider(): HotelProvider {
  const hotelExplicit = process.env.HOTEL_PROVIDER
    ? String(process.env.HOTEL_PROVIDER).toLowerCase()
    : "";

  if (hotelExplicit === "mock") {
    return new MockHotelProvider();
  }

  const useDuffel =
    hotelExplicit === "duffel" ||
    (!hotelExplicit &&
      String(process.env.FLIGHT_PROVIDER || "mock").toLowerCase() === "duffel");

  return useDuffel ? new ResilientHotelProvider() : new MockHotelProvider();
}

/** Etiqueta del proveedor efectivamente usado tras una búsqueda. */
export function getActiveHotelProviderLabel(
  provider: HotelProvider,
): HotelProviderLabel {
  if (provider instanceof ResilientHotelProvider) {
    return provider.lastProviderUsed === "mock_fallback" ? "mock_fallback" : "duffel";
  }
  return "mock";
}

/** ¿El proveedor soporta `fetch_all_rates`? (solo Duffel Stays). */
export function supportsFetchRates(
  provider: HotelProvider,
): provider is ResilientHotelProvider {
  return provider instanceof ResilientHotelProvider;
}
