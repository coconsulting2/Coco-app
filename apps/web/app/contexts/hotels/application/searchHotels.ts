/**
 * @module searchHotels
 * @description Use-case con DI: busca hospedaje con el proveedor configurado.
 * Reproduce la lógica del legacy `postHotelSearch`: valida el rango de fechas,
 * delega al proveedor (resiliente Duffel→mock) y mapea el 403 de Stays a un
 * error 503 tipado.
 */
import { isStaysAccessDeniedError } from "@coco/integrations/duffel";
import type {
  HotelProvider,
  StaySearchInputApp,
  HotelSearchOffer,
} from "~/contexts/hotels/domain/ports/HotelProvider.js";
import type { HotelProviderLabel } from "~/contexts/hotels/domain/ports/HotelProvider.js";
import {
  InvalidStayDatesError,
  StaysNotEnabledError,
} from "~/contexts/hotels/domain/errors.js";

export type SearchHotelsInput = StaySearchInputApp;

export type SearchHotelsDeps = {
  /** Proveedor activo según configuración (mock o Duffel resiliente). */
  provider: HotelProvider;
  /** Resuelve la etiqueta efectiva tras la búsqueda (`duffel`/`mock`/`mock_fallback`). */
  resolveLabel: (provider: HotelProvider) => HotelProviderLabel;
  logger?: { error(msg: string): void };
};

export type SearchHotelsResult = {
  offers: HotelSearchOffer[];
  provider: HotelProviderLabel;
};

export async function searchHotels(
  input: SearchHotelsInput,
  deps: SearchHotelsDeps,
): Promise<SearchHotelsResult> {
  if (String(input.fechaEntrada) >= String(input.fechaSalida)) {
    throw new InvalidStayDatesError();
  }

  try {
    const offers = await deps.provider.searchOffers(input);
    return { offers, provider: deps.resolveLabel(deps.provider) };
  } catch (err) {
    deps.logger?.error(`[hotels/search] ${(err as Error)?.message ?? String(err)}`);
    if (isStaysAccessDeniedError(err)) {
      throw new StaysNotEnabledError();
    }
    throw err;
  }
}
