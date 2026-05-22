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
