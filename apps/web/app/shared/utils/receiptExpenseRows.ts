/**
 * Normaliza filas de GET /accounts-payable/get-expense-validations/:id
 * y metadatos de /files/receipt-files/:id para ReceiptDetailCard.
 *
 * @deprecated Este helper se cargaba desde un Astro .astro legacy
 * (`RequestExpensesValidationSection.astro`) que ya no se renderiza bajo
 * RR7. Permanece compilando para conservar tipos `ReceiptDisplayRow` que
 * otros componentes podrían reutilizar.
 */
import type { ReceiptCfdi, ReceiptFile } from "@components/ReceiptDetailCard";

export interface ExpenseValidationApiRow {
  receipt_id: number;
  receipt_type_name?: string;
  amount: number;
  validation: string;
  expense_status?: string;
  cfdi?: ReceiptCfdi | null;
}

export interface ReceiptDisplayRow {
  receipt_id: number;
  receipt_type_name: string;
  amount: number;
  validation: string;
  expense_status: string;
  cfdi: ReceiptCfdi | null;
  pdf: ReceiptFile | null;
  xml: ReceiptFile | null;
  receipt_image: ReceiptFile | null;
}

function asReceiptFile(value: unknown): ReceiptFile | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.fileId === "string" && typeof v.fileName === "string") {
    return { fileId: v.fileId, fileName: v.fileName };
  }
  return null;
}

function asReceiptCfdi(value: unknown): ReceiptCfdi | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.uuid !== "string") return null;
  return {
    nombreEmisor: String(v.nombreEmisor ?? ""),
    rfcEmisor: String(v.rfcEmisor ?? ""),
    fechaEmision: String(v.fechaEmision ?? ""),
    subtotal: Number(v.subtotal ?? 0),
    iva: Number(v.iva ?? 0),
    total: Number(v.total ?? 0),
    moneda: String(v.moneda ?? "MXN"),
    uuid: v.uuid,
    satEstado: String(v.satEstado ?? ""),
    tipoComprobante: String(v.tipoComprobante ?? ""),
  };
}

/**
 * Mapea filas de expense validation a la forma denormalizada que consume
 * el componente `ReceiptDetailCard`. Recibe el `fileMap` ya resuelto
 * (antes lo cargaba un `apiRequest` con cookies Astro — ahora debe venir
 * del loader del route padre).
 */
export function mapExpenseValidationRow(
  expense: ExpenseValidationApiRow,
  fileMap: Record<string, unknown> | null,
): ReceiptDisplayRow {
  return {
    receipt_id: Number(expense.receipt_id),
    receipt_type_name: String(expense.receipt_type_name ?? ""),
    amount: Number(expense.amount),
    validation: String(expense.validation ?? ""),
    expense_status: String(expense.expense_status ?? ""),
    cfdi: asReceiptCfdi(expense.cfdi),
    pdf: asReceiptFile(fileMap?.pdf),
    xml: asReceiptFile(fileMap?.xml),
    receipt_image: asReceiptFile(fileMap?.receipt_image),
  };
}
