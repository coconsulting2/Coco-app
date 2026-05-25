/**
 * @module HotelProvider
 * @description Puerto del slice hotels. Un adapter concreto busca ofertas de
 * hospedaje (Duffel Stays o mock). Los adapters viven en `infrastructure/`.
 */
import type { StaySearchInputApp } from "@coco/integrations/duffel";
import type { HotelSearchOffer } from "~/contexts/hotels/domain/entities/HotelQuote.js";

export type { StaySearchInputApp, HotelSearchOffer };

/** Etiqueta del proveedor activo (para el contrato de respuesta). */
export type HotelProviderLabel = "duffel" | "mock" | "mock_fallback";

export interface HotelProvider {
  /** Busca ofertas normalizadas de hospedaje. */
  searchOffers(params: StaySearchInputApp): Promise<HotelSearchOffer[]>;
  /** Etiqueta del último proveedor efectivamente usado. */
  readonly lastProviderUsed: HotelProviderLabel;
}
