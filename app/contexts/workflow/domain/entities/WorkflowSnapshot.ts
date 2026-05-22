/**
 * @module WorkflowSnapshot
 * @description Entidad de dominio del slice workflow. Tipos puros —
 * los mappers en `infrastructure/` traducen entre Prisma y este shape.
 */

export type WorkflowSnapshot = {
  requestId: number;
  currentLevel: number;
  approvers: Array<{ userId: number; level: number; status: string }>;
  rules: Array<object>;
};
