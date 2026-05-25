/**
 * @module AccountsPayableLifecycleSyncer
 * @description Adapter para el port `ReceiptsLifecycleSyncer`. Delega en
 * `AccountsPayableService.validateReceiptsAndUpdateStatus(requestId)` que
 * mueve la solicitud a status 8 (Finalizado) cuando todos los receipts
 * están aprobados, o a status 6 si hay algún rechazado.
 */
import AccountsPayableService from "~/contexts/accounts-payable/application/accountsPayableService.js";
import type {
  ReceiptsLifecycleSyncer,
  SyncRequestStatusResult,
} from "~/contexts/receipts-cfdi/domain/ports/ReceiptsLifecycleSyncer.js";

export class AccountsPayableLifecycleSyncer implements ReceiptsLifecycleSyncer {
  async syncRequestStatusAfterReceiptDecision(requestId: number): Promise<SyncRequestStatusResult> {
    const result = (await AccountsPayableService.validateReceiptsAndUpdateStatus(requestId)) as {
      updatedStatus: number | null;
      message: string;
    };
    return result;
  }
}
