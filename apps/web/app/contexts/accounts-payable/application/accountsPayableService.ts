/**
 * @module accountsPayableService
 * @description Handles business logic for the Accounts Payable workflow,
 * including receipt validation and automatic request-status transitions.
 */
import AccountsPayable from "~/contexts/accounts-payable/infrastructure/accountsPayableModel.js";
import anticipoPolizaLifecycleService from "~/contexts/accounts-payable/application/anticipoPolizaLifecycleService";
import { confirmImposedFee } from "~/contexts/accounts-payable/application/confirmImposedFee.js";
import { PrismaCxpAttendRepository } from "~/contexts/accounts-payable/infrastructure/PrismaCxpAttendRepository.js";

/** Resultado de evaluar los recibos de una solicitud. */
export interface ValidateReceiptsResult {
  updatedStatus: number | null;
  message: string;
}

/** Resultado de atender una solicitud por CxP. */
export interface AttendTravelRequestResult {
  message: string;
  requestId: number;
  imposedFee: number;
  newStatus: number;
}

const cxpAttendRepo = new PrismaCxpAttendRepository();

/**
 * Atiende una solicitud (status 4 → agencia/CxP) fijando el imposed_fee y
 * avanzando el estatus: a status 5 si requiere hotel/avión, si no a status 6.
 *
 * Delega en el use-case hexagonal canónico `confirmImposedFee` (port + adapter
 * Prisma) para no duplicar la lógica de transición. Conservado únicamente como
 * shim del dispatcher legacy `PUT attend-travel-request/:id`.
 *
 * @throws {CxpRequestNotFoundError} 404 si la Request no existe.
 * @throws {CxpRequestNotAttendableError} 404 si la Request no está en status 4.
 */
async function attendTravelRequest(
  requestId: number,
  imposedFee: number,
): Promise<AttendTravelRequestResult> {
  const { newStatusId } = await confirmImposedFee(
    { requestId, imposedFee },
    { attendRepo: cxpAttendRepo },
  );

  return {
    message: "Travel request status updated successfully",
    requestId,
    imposedFee,
    newStatus: newStatusId,
  };
}

const AccountsPayableService = {
  attendTravelRequest,
  /**
   * Checks the receipt statuses for a given request and advances (or rolls back)
   * the request status accordingly:
   * - Any rejected receipt → status 6 (returned to previous step)
   * - All receipts approved → status 8 (Finalizado)
   * - Receipts still pending → no status change
   */
  async validateReceiptsAndUpdateStatus(requestId: number): Promise<ValidateReceiptsResult> {
    const statuses = await AccountsPayable.getReceiptStatusesForRequest(requestId);

    if (statuses.includes("Rechazado")) {
      await AccountsPayable.updateRequestStatus(requestId, 6);
      return {
        updatedStatus: 6,
        message: "Some receipts were rejected. Request moved back to step 6.",
      };
    }

    const allApproved = statuses.every((s) => s === "Aprobado");
    if (allApproved) {
      await AccountsPayable.updateRequestStatus(requestId, 8); // Finalizado
      try {
        await anticipoPolizaLifecycleService.onExpensesVerified(requestId);
      } catch (err) {
        console.error("onExpensesVerified:", (err as Error)?.message || err);
      }
      return {
        updatedStatus: 8,
        message: "All receipts approved. Request finalized.",
      };
    }

    return {
      updatedStatus: null,
      message: "Receipts still pending. No status change applied.",
    };
  },
};

export { attendTravelRequest };
export default AccountsPayableService;
