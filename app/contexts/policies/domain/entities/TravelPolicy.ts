/**
 * @module TravelPolicy
 * @description Entidad de dominio del slice policies. Tipos puros —
 * los mappers en `infrastructure/` traducen entre Prisma y este shape.
 */

export type TravelPolicy = {
  policyId: number;
  organizationId: bigint;
  name: string;
  caps: Record<string, number>;
  active: boolean;
};
