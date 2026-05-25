/**
 * @module draftTravelRequest
 * @description Use-cases puros (DI) para borradores:
 *   - `createDraftTravelRequest`: guarda un borrador (status 1) con campos
 *     parciales (el adapter legacy rellena defaults).
 *   - `confirmDraftTravelRequest`: confirma un borrador → primera etapa de
 *     aprobación (el flujo transaccional legacy resuelve workflow snapshot +
 *     refund context). NOTA: el legacy NO aplica policy de viáticos aquí.
 */
import type {
  CreateTravelRequestInput,
  RequestId,
  UserId,
} from "~/contexts/travel-requests/domain/entities/Request.js";
import type {
  TravelRequestDraftWriter,
  DraftTravelRequest,
} from "~/contexts/travel-requests/domain/ports/TravelRequestDraftWriter.js";
import { InvalidTravelRequestInputError } from "~/contexts/travel-requests/domain/errors.js";

export type DraftTravelRequestDeps = { draftWriter: TravelRequestDraftWriter };

export async function createDraftTravelRequest(
  userId: UserId,
  partial: Partial<CreateTravelRequestInput>,
  deps: DraftTravelRequestDeps,
): Promise<DraftTravelRequest> {
  if (!userId || userId < 1) {
    throw new InvalidTravelRequestInputError("userId requerido para guardar borrador");
  }
  return deps.draftWriter.createDraft(userId, partial);
}

export async function confirmDraftTravelRequest(
  userId: UserId,
  requestId: RequestId,
  deps: DraftTravelRequestDeps,
): Promise<DraftTravelRequest> {
  if (!userId || userId < 1) {
    throw new InvalidTravelRequestInputError("userId requerido para confirmar borrador");
  }
  if (!requestId || requestId < 1) {
    throw new InvalidTravelRequestInputError("requestId requerido para confirmar borrador");
  }
  return deps.draftWriter.confirmDraft(userId, requestId);
}
