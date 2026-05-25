/**
 * @module PrismaTravelRequestDraftWriter
 * @description Adapter del port `TravelRequestDraftWriter`. Mappea el partial
 * del dominio al body snake_case que esperan `Applicant.createDraftTravelRequest`
 * (rellena defaults) y delega `confirmDraftTravelRequest` (resuelve workflow
 * snapshot + refund context).
 */
import Applicant from "~/contexts/travel-requests/infrastructure/applicantModel.js";
import { legToSnake } from "~/contexts/travel-requests/infrastructure/legacyRouteMapper.js";
import type {
  CreateTravelRequestInput,
  RequestId,
  UserId,
} from "~/contexts/travel-requests/domain/entities/Request.js";
import type {
  TravelRequestDraftWriter,
  DraftTravelRequest,
} from "~/contexts/travel-requests/domain/ports/TravelRequestDraftWriter.js";

type DraftIdResult = { requestId?: number; request_id?: number } | null;

export class PrismaTravelRequestDraftWriter implements TravelRequestDraftWriter {
  async createDraft(
    userId: UserId,
    partial: Partial<CreateTravelRequestInput>,
  ): Promise<DraftTravelRequest> {
    const body: Record<string, unknown> = {
      notes: partial.notes ?? "",
      requested_fee: partial.requestedFee ?? 0,
      imposed_fee: 0,
      additionalRoutes: (partial.additionalRoutes ?? []).map((leg, idx) =>
        legToSnake(leg, idx + 1),
      ),
    };
    if (partial.mainRoute) {
      Object.assign(body, legToSnake(partial.mainRoute, 0));
    }

    const raw = (await Applicant.createDraftTravelRequest(userId, body)) as DraftIdResult;
    const requestId = Number(raw?.requestId ?? raw?.request_id ?? 0);
    if (!Number.isFinite(requestId) || requestId < 1) {
      throw new Error("Applicant.createDraftTravelRequest no devolvió un requestId válido.");
    }
    return { requestId };
  }

  async confirmDraft(userId: UserId, requestId: RequestId): Promise<DraftTravelRequest> {
    const raw = (await Applicant.confirmDraftTravelRequest(
      userId,
      requestId,
    )) as DraftIdResult;
    const confirmedId = Number(raw?.requestId ?? raw?.request_id ?? requestId);
    return { requestId: confirmedId };
  }
}
