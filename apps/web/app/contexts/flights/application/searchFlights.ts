/**
 * @module searchFlights
 * @description Use-case con DI: busca ofertas de vuelo usando el proveedor
 * configurado (`FLIGHT_PROVIDER`). Reproduce la lógica del legacy
 * `postFlightSearch`: si el proveedor activo es Duffel y falla, cae al mock.
 */
import type {
  FlightProvider,
  FlightSearchParams,
  NormalizedFlightOffer,
} from "~/contexts/flights/domain/ports/FlightProvider.js";
import type { FlightProviderLabel } from "~/contexts/flights/infrastructure/flightProvider.js";

export type SearchFlightsInput = FlightSearchParams;

export type SearchFlightsDeps = {
  /** Proveedor activo según configuración. */
  provider: FlightProvider;
  /** Etiqueta del proveedor activo (`duffel` | `mock`). */
  providerLabel: FlightProviderLabel;
  /** Proveedor mock para fallback cuando Duffel falla. */
  mockProvider: FlightProvider;
  /** Logger opcional (warn de fallback / error). */
  logger?: { warn(msg: string): void; error(msg: string): void };
};

export type SearchFlightsResult = {
  offers: NormalizedFlightOffer[];
  provider: FlightProviderLabel;
  fallback?: boolean;
};

export async function searchFlights(
  input: SearchFlightsInput,
  deps: SearchFlightsDeps,
): Promise<SearchFlightsResult> {
  try {
    const offers = await deps.provider.searchOffers(input);
    return { offers, provider: deps.providerLabel };
  } catch (err) {
    if (deps.providerLabel === "duffel") {
      deps.logger?.warn(
        `[flights/search] Duffel error, fallback mock: ${(err as Error)?.message ?? String(err)}`,
      );
      const offers = await deps.mockProvider.searchOffers(input);
      return { offers, provider: "mock", fallback: true };
    }
    deps.logger?.error(`[flights/search] ${(err as Error)?.message ?? String(err)}`);
    throw err;
  }
}
