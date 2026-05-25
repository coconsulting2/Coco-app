/**
 * @module ReceiptValidationRepository
 * @description Puerto para leer/escribir el estado de validación de un
 * comprobante individual (Pendiente | Aprobado | Rechazado).
 */
import type {
  ReceiptDecision,
  ReceiptForValidation,
  RequestReceiptsForValidation,
} from "~/contexts/receipts-cfdi/domain/entities/ReceiptValidation.js";

export interface ReceiptValidationRepository {
  /** Carga el receipt con el subset necesario para decidir aprobación/rechazo. */
  findForValidation(receiptId: number): Promise<ReceiptForValidation | null>;
  /**
   * Aplica la decisión a la fila del receipt. Retorna `true` si la fila se
   * actualizó (la operación es idempotente respecto al valor objetivo).
   */
  setValidation(receiptId: number, decision: ReceiptDecision): Promise<boolean>;
  /**
   * Carga todos los receipts de una solicitud junto con su estado de
   * validación y meta-data fiscal (para la UI de validación CxP).
   * Devuelve `null` si la solicitud no existe.
   */
  listForRequest(requestId: number): Promise<RequestReceiptsForValidation | null>;
}
