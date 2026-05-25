/**
 * @module HotelQuote
 * @description Entidades de dominio del slice hotels.
 */
import type { NormalizedStayOffer, EnrichedStayOffer } from "@coco/integrations/duffel";

/** Oferta normalizada de hospedaje (sin tarifas resueltas todavía). */
export type StayOffer = NormalizedStayOffer;

/** Oferta enriquecida con `rates` resueltos vía fetch_all_rates. */
export type EnrichedStay = EnrichedStayOffer;

/** Snapshot que se persiste en Request.selectedHotelOffer (JSON). */
export type SelectedHotelOffer = StayOffer | EnrichedStay;

/**
 * Oferta de hospedaje tal cual la devuelve un proveedor de búsqueda. Igual que
 * `StayOffer` pero con `provider` ampliado para cubrir el mock / fallback.
 */
export type HotelSearchOffer = Omit<StayOffer, "provider"> & {
  provider: "duffel_stays" | "mock" | "mock_fallback";
};

export type StaySearchInput = {
  ciudad: string;
  fechaEntrada: string;
  fechaSalida: string;
  huespedes: number;
};

/** Mantenido por compatibilidad con código legacy. */
export type HotelQuote = {
  quoteId: string;
  hotelName: string;
  city: string;
  checkIn: Date;
  checkOut: Date;
  nightlyRate: number;
  currency: string;
};
