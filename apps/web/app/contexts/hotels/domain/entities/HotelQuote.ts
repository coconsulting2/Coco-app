/**
 * @module HotelQuote
 * @description Entidad de dominio del slice hotels. Tipos puros —
 * los mappers en `infrastructure/` traducen entre Prisma y este shape.
 */

export type HotelQuote = {
  quoteId: string;
  hotelName: string;
  city: string;
  checkIn: Date;
  checkOut: Date;
  nightlyRate: number;
  currency: string;
};
