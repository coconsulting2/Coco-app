/**
 * @module Approval
 * @description Entidad de dominio del slice approvals. Tipos puros —
 * los mappers en `infrastructure/` traducen entre Prisma y este shape.
 */

export type Approval = {
  requestId: number;
  approverUserId: number;
  level: 1 | 2;
  decision: "approved" | "rejected" | "pending";
  rejectionReason: string | null;
  decidedAt: Date | null;
};
