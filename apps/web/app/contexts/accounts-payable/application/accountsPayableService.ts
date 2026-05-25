/**
 * @module accountsPayableService
 * @description Handles business logic for the Accounts Payable workflow,
 * including receipt validation and automatic request-status transitions.
 */
import AccountsPayable from "~/contexts/accounts-payable/infrastructure/accountsPayableModel.js";
import anticipoPolizaLifecycleService from "~/contexts/accounts-payable/application/anticipoPolizaLifecycleService";
import { AccountsPayableError } from "~/contexts/accounts-payable/domain/errors";

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

/** True si la lista CSV (hotel/avión) incluye un "1" (servicio requerido). */
function csvListNeedsService(csv: string | null | undefined): boolean {
  if (!csv || typeof csv !== "string") return false;
  return csv
    .split(",")
    .map((s) => s.trim())
    .includes("1");
}

/**
 * Atiende una solicitud (status 4 → agencia/CxP) fijando el imposed_fee y
 * avanzando el estatus: a status 5 si requiere hotel/avión, si no a status 6.
 * Réplica de `accountsPayableController.attendTravelRequest` sin HTTP/email.
 *
 * @throws {AccountsPayableError} 404 si no existe o no es atendible; 400 si falla el update.
 */
async function attendTravelRequest(
  requestId: number,
  imposedFee: number,
): Promise<AttendTravelRequestResult> {
  const request = await AccountsPayable.requestExists(requestId);
  if (!request) {
    throw new AccountsPayableError("Travel request not found", "NOT_FOUND", 404);
  }

  if (request.request_status_id !== 4) {
    throw new AccountsPayableError(
      "This request cannot be attended by accounts payable",
      "INVALID_STATUS",
      404,
    );
  }

  const newStatus =
    csvListNeedsService(request.hotel_needed_list) ||
    csvListNeedsService(request.plane_needed_list)
      ? 5
      : 6;

  const updated = await AccountsPayable.attendTravelRequest(requestId, imposedFee, newStatus);
  if (!updated) {
    throw new AccountsPayableError(
      "Failed to update travel request status",
      "UPDATE_FAILED",
      400,
    );
  }

  return {
    message: "Travel request status updated successfully",
    requestId,
    imposedFee,
    newStatus,
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
