/**
 * @module FlightQuote
 * @description Entidades de dominio del slice flights.
 */
import type { NormalizedFlightOffer } from "@coco/integrations/duffel";

/** Oferta normalizada de vuelo — la firma viene de @coco/integrations.duffel. */
export type FlightOffer = NormalizedFlightOffer;

/** Snapshot persistente de la oferta seleccionada en una Request. */
export type SelectedFlightOffer = NormalizedFlightOffer;

/** Inputs para búsqueda — alineado con el contrato de duffel.searchFlightOffers. */
export type FlightSearchInput = {
  origen: string;
  destino: string;
  fecha: string;
  fechaRegreso?: string;
  pasajeros: number;
};

/** Mantenido por compatibilidad con código legacy. */
export type FlightQuote = {
  quoteId: string;
  origin: string;
  destination: string;
  departDate: Date;
  price: number;
  currency: string;
};
