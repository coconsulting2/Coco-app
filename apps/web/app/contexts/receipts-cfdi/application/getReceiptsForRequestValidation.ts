/**
 * @module getReceiptsForRequestValidation
 * @description Use-case puro (DI por parámetro) que devuelve los receipts
 * asociados a una solicitud, con su estado de validación + meta-data
 * fiscal. Lo consume el loader de `comprobar-gastos.$id` (CxP) y el de
 * `comprobar-solicitud.$id` (Solicitante en read-only).
 */
import type { ReceiptValidationRepository } from "~/contexts/receipts-cfdi/domain/ports/ReceiptValidationRepository.js";
import type { RequestReceiptsForValidation } from "~/contexts/receipts-cfdi/domain/entities/ReceiptValidation.js";

export type GetReceiptsForRequestValidationInput = {
  requestId: number;
};

export type GetReceiptsForRequestValidationDeps = {
  receipts: ReceiptValidationRepository;
};

export async function getReceiptsForRequestValidation(
  input: GetReceiptsForRequestValidationInput,
  deps: GetReceiptsForRequestValidationDeps,
): Promise<RequestReceiptsForValidation | null> {
  return deps.receipts.listForRequest(input.requestId);
}
