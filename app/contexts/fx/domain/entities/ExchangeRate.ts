/**
 * @module ExchangeRate
 * @description Entidad de dominio del slice fx. Tipos puros —
 * los mappers en `infrastructure/` traducen entre Prisma y este shape.
 */

export type ExchangeRate = {
  source: string;
  target: string;
  rate: number;
  asOf: Date;
};
