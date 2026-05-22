/**
 * @module requestReceiptUploadPolicy
 * @description Reglas de negocio: alta de comprobantes solo después de que
 * N2 haya aprobado (status >= 4), hasta validación de comprobantes (7).
 * Bloquea cuando el plazo de reembolso (M2-006 RF-39) está vencido.
 */
import Applicant from "~/contexts/travel-requests/infrastructure/applicantModel.js";
import { assertCanSubmitReceipts } from "~/contexts/refunds/application/reimbursementTimeService.js";

export const MIN_STATUS_FOR_RECEIPT_UPLOAD = 4;
export const MAX_STATUS_FOR_RECEIPT_UPLOAD = 7;

export class ReceiptUploadPolicyError extends Error {
  readonly status: number;
  readonly code = "RECEIPTUPLOADPOLICY";
  constructor(status: number, message: string) {
    super(message);
    this.name = "ReceiptUploadPolicyError";
    this.status = status;
  }
}

export function requestAllowsReceiptUpload(statusId: number | string): boolean {
  const n = Number(statusId);
  return (
    Number.isFinite(n) &&
    n >= MIN_STATUS_FOR_RECEIPT_UPLOAD &&
    n <= MAX_STATUS_FOR_RECEIPT_UPLOAD
  );
}

export async function assertRequestAllowsReceiptUpload(requestId: number): Promise<void> {
  const status = (await Applicant.getRequestStatus(Number(requestId))) as number | null;
  if (status === null || status === undefined) {
    throw new ReceiptUploadPolicyError(404, `No request found with id ${requestId}`);
  }
  if (!requestAllowsReceiptUpload(status)) {
    throw new ReceiptUploadPolicyError(
      403,
      "No se pueden registrar comprobantes hasta que la solicitud haya sido aprobada por N2 (estado Cotización del Viaje o fases posteriores hasta validación de comprobantes).",
    );
  }
  await assertCanSubmitReceipts(Number(requestId));
}
