/**
 * @module AgencyAttention
 * @description Entidad de dominio del slice travel-agency. Tipos puros —
 * los mappers en `infrastructure/` traducen entre Prisma y este shape.
 */

export type AgencyAttention = {
  requestId: number;
  agencyUserId: number;
  itinerary: object | null;
  totalCost: number | null;
};
