/**
 * @module ReceiptValidation
 * @description Entidad de dominio para validación de comprobantes (CFDI).
 * Shape consumido por el use-case `validateReceiptDecision`. Los adapters
 * en `infrastructure/` traducen entre Prisma y este shape.
 */

export type ReceiptValidationStatus = "Pendiente" | "Aprobado" | "Rechazado";

export type ReceiptDecision = "approve" | "reject";

/**
 * Subconjunto del CFDI que el use-case de validación necesita para
 * consultar SAT. El adapter Prisma mappea desde la fila completa.
 */
export type ReceiptCfdiComprobante = {
  rfcEmisor: string;
  rfcReceptor: string;
  total: number;
  uuid: string;
};

export type ReceiptForValidation = {
  receiptId: number;
  requestId: number;
  validation: ReceiptValidationStatus;
  receiptTypeName: string | null;
  cfdiComprobante: ReceiptCfdiComprobante | null;
};

/**
 * Shape de cada renglón en la vista del CxP de "validar comprobantes de una
 * solicitud". Lo consume `ReceiptDetailCard` (presentational) — el adapter
 * Prisma mappea desde el resultado de `AccountsPayable.getExpenseValidations`.
 */
export type ReceiptValidationListItemCfdi = {
  nombreEmisor: string;
  rfcEmisor: string;
  fechaEmision: string;
  subtotal: number;
  iva: number;
  total: number;
  moneda: string;
  uuid: string;
  satEstado: string;
  tipoComprobante: string;
};

export type ReceiptValidationListItem = {
  receiptId: number;
  receiptTypeName: string;
  amount: number;
  validation: ReceiptValidationStatus;
  pdfFileId: string | null;
  pdfFileName: string | null;
  xmlFileId: string | null;
  xmlFileName: string | null;
  cfdi: ReceiptValidationListItemCfdi | null;
};

export type RequestReceiptsForValidation = {
  requestId: number;
  requestStatusId: number | null;
  requestStatusName: string | null;
  hasPending: boolean;
  items: ReceiptValidationListItem[];
};
