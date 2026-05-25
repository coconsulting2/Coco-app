/**
 * @module PrismaReceiptValidationRepository
 * @description Adapter que implementa el port `ReceiptValidationRepository`
 * sobre el model legacy `AccountsPayable` (Prisma). El model expone
 * `findReceiptForValidation` y `validateReceipt(receiptId, n)` donde
 * `n` ∈ {1=Pendiente, 2=Aprobado, 3=Rechazado}.
 */
import AccountsPayable from "~/contexts/accounts-payable/infrastructure/accountsPayableModel.js";
import type {
  ReceiptDecision,
  ReceiptForValidation,
  ReceiptValidationListItem,
  ReceiptValidationListItemCfdi,
  ReceiptValidationStatus,
  RequestReceiptsForValidation,
} from "~/contexts/receipts-cfdi/domain/entities/ReceiptValidation.js";
import type { ReceiptValidationRepository } from "~/contexts/receipts-cfdi/domain/ports/ReceiptValidationRepository.js";

type LegacyReceiptRow = {
  receipt_id: number;
  request_id: number;
  validation: ReceiptValidationStatus;
  receipt_type_name: string | null;
  cfdiComprobante:
    | {
        rfcEmisor: string;
        rfcReceptor: string;
        total: unknown;
        uuid: string;
      }
    | null;
};

function decisionToValidationCode(decision: ReceiptDecision): 2 | 3 {
  return decision === "approve" ? 2 : 3;
}

function toFinite(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value);
  if (value && typeof value === "object" && "toNumber" in value) {
    const fn = (value as { toNumber: () => number }).toNumber;
    if (typeof fn === "function") return fn.call(value);
  }
  return Number(value);
}

export class PrismaReceiptValidationRepository implements ReceiptValidationRepository {
  async findForValidation(receiptId: number): Promise<ReceiptForValidation | null> {
    const row = (await AccountsPayable.findReceiptForValidation(receiptId)) as
      | LegacyReceiptRow
      | undefined
      | null;
    if (!row) return null;
    const cfdi = row.cfdiComprobante;
    return {
      receiptId: row.receipt_id,
      requestId: row.request_id,
      validation: row.validation,
      receiptTypeName: row.receipt_type_name ?? null,
      cfdiComprobante: cfdi
        ? {
            rfcEmisor: cfdi.rfcEmisor,
            rfcReceptor: cfdi.rfcReceptor,
            total: toFinite(cfdi.total),
            uuid: cfdi.uuid,
          }
        : null,
    };
  }

  async setValidation(receiptId: number, decision: ReceiptDecision): Promise<boolean> {
    const code = decisionToValidationCode(decision);
    const updated = (await AccountsPayable.validateReceipt(receiptId, code)) as boolean;
    return Boolean(updated);
  }

  async listForRequest(requestId: number): Promise<RequestReceiptsForValidation | null> {
    const raw = (await AccountsPayable.getExpenseValidations(requestId)) as LegacyExpenseValidationsResult;
    if (!raw) return null;
    const items: ReceiptValidationListItem[] = (raw.Expenses ?? []).map((row) => ({
      receiptId: row.receipt_id,
      receiptTypeName: row.receipt_type_name ?? "",
      amount: toFinite(row.amount),
      validation: row.validation,
      pdfFileId: row.pdf_id ?? null,
      pdfFileName: row.pdf_name ?? null,
      xmlFileId: row.xml_id ?? null,
      xmlFileName: row.xml_name ?? null,
      cfdi: row.cfdi ? toCfdiViewModel(row.cfdi) : null,
    }));
    return {
      requestId: raw.request_id,
      requestStatusId: raw.request_status_id ?? null,
      requestStatusName: raw.request_status_name ?? null,
      hasPending: items.some((i) => i.validation === "Pendiente"),
      items,
    };
  }
}

type LegacyCfdiRow = {
  nombreEmisor: string;
  rfcEmisor: string;
  fechaEmision: Date | string;
  subtotal: unknown;
  iva: unknown;
  total: unknown;
  moneda: string;
  uuid: string;
  satEstado: string | null;
  tipoComprobante: string;
};

type LegacyExpenseRow = {
  receipt_id: number;
  receipt_type_name?: string | null;
  amount: unknown;
  validation: ReceiptValidationStatus;
  sat_estado?: string | null;
  pdf_id?: string | null;
  pdf_name?: string | null;
  xml_id?: string | null;
  xml_name?: string | null;
  cfdi: LegacyCfdiRow | null;
};

type LegacyExpenseValidationsResult = {
  request_id: number;
  request_status_id: number | null;
  request_status_name: string | null;
  Expenses: LegacyExpenseRow[];
} | null;

function toCfdiViewModel(c: LegacyCfdiRow): ReceiptValidationListItemCfdi {
  return {
    nombreEmisor: c.nombreEmisor,
    rfcEmisor: c.rfcEmisor,
    fechaEmision: typeof c.fechaEmision === "string" ? c.fechaEmision : c.fechaEmision.toISOString(),
    subtotal: toFinite(c.subtotal),
    iva: toFinite(c.iva),
    total: toFinite(c.total),
    moneda: c.moneda,
    uuid: c.uuid,
    satEstado: c.satEstado ?? "",
    tipoComprobante: c.tipoComprobante,
  };
}
