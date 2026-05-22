/**
 * @module RefundRule
 * @description Entidad de dominio del slice refunds. Tipos puros —
 * los mappers en `infrastructure/` traducen entre Prisma y este shape.
 */

export type RefundRule = {
  ruleId: number;
  organizationId: bigint;
  daysDeadline: number;
  categoryId: number | null;
  active: boolean;
};
