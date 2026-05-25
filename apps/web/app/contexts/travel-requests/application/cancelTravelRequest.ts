/**
 * @module cancelTravelRequest
 * @description Use-case puro (DI) que cancela una solicitud. Paridad 1:1 con
 * el legacy `applicantService.cancelTravelRequestValidation`:
 *   - 404 si la solicitud no existe,
 *   - no cancelable si el status no está en [1,2,3,4,5,9] (tras "Atención
 *     Agencia de Viajes" ya no se puede),
 *   - error si ya está cancelada (status 9),
 *   - cancela (status → 9) en el happy path.
 */
import type { TravelRequestCanceller } from "~/contexts/travel-requests/domain/ports/TravelRequestCanceller.js";
import {
  RequestNotFoundError,
  RequestNotCancellableError,
} from "~/contexts/travel-requests/domain/errors.js";

const CANCELLABLE_STATUSES = [1, 2, 3, 4, 5, 9];

export type CancelTravelRequestInput = { requestId: number };
export type CancelTravelRequestDeps = { canceller: TravelRequestCanceller };
export type CancelTravelRequestResult = {
  requestId: number;
  requestStatusId: 9;
  active: false;
};

export async function cancelTravelRequest(
  input: CancelTravelRequestInput,
  deps: CancelTravelRequestDeps,
): Promise<CancelTravelRequestResult> {
  const status = await deps.canceller.getRequestStatus(input.requestId);
  if (status === null) {
    throw new RequestNotFoundError(input.requestId);
  }
  if (!CANCELLABLE_STATUSES.includes(status)) {
    throw new RequestNotCancellableError(String(status));
  }
  if (status === 9) {
    throw new RequestNotCancellableError("Cancelado");
  }

  await deps.canceller.cancel(input.requestId);
  return { requestId: input.requestId, requestStatusId: 9, active: false };
}
