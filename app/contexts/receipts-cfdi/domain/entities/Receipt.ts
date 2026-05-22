/**
 * @module Receipt
 * @description Entidad de dominio del slice receipts-cfdi. Tipos puros —
 * los mappers en `infrastructure/` traducen entre Prisma y este shape.
 */

export type Receipt = {
  receiptId: number;
  requestId: number;
  cfdiUuid: string | null;
  amount: number;
  currency: string;
  issueDate: Date;
  status: "pending" | "approved" | "rejected";
};
