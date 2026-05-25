/**
 * @module ReceiptsLifecycleSyncer
 * @description Puerto para sincronizar el status de la solicitud después
 * de una validación individual de receipt (e.g. mover a Finalizado cuando
 * todos los receipts están aprobados, o rollback al paso anterior si alguno
 * fue rechazado). El adapter por defecto wrappea el slice `accounts-payable`.
 */
export type SyncRequestStatusResult = {
  updatedStatus: number | null;
  message: string;
};

export interface ReceiptsLifecycleSyncer {
  syncRequestStatusAfterReceiptDecision(requestId: number): Promise<SyncRequestStatusResult>;
}
