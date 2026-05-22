/**
 * @module FlightQuote
 * @description Entidad de dominio del slice flights. Tipos puros —
 * los mappers en `infrastructure/` traducen entre Prisma y este shape.
 */

export type FlightQuote = {
  quoteId: string;
  origin: string;
  destination: string;
  departDate: Date;
  price: number;
  currency: string;
};
