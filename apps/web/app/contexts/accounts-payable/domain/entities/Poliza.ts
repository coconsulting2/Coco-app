/**
 * @module Poliza
 * @description Entidad de dominio del slice accounts-payable. Tipos puros —
 * los mappers en `infrastructure/` traducen entre Prisma y este shape.
 */

export type Poliza = {
  polizaId: string;
  requestId: number;
  kind: "AV" | "GV";
  totalAmount: number;
  status: "draft" | "exported" | "void";
  exportedAt: Date | null;
};
