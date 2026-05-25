/**
 * @module ReceiptValidationSubmission (port)
 * @description Operaciones de persistencia necesarias para que el Solicitante
 * envíe sus comprobantes a validación (transición de status 6 → 7).
 */
export interface ReceiptValidationSubmission {
  /** Status actual de la solicitud, o `null` si no existe. */
  getRequestStatus(requestId: number): Promise<number | null>;
  /** Marca la solicitud en "Validación de comprobantes" (status 7). */
  updateStatusToValidationStage(requestId: number): Promise<void>;
}
