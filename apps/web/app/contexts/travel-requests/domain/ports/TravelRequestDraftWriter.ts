/**
 * @module TravelRequestDraftWriter
 * @description Puerto cohesivo para borradores: crear borrador (status 1) y
 * confirmar borrador (transición a la primera etapa de aprobación). El adapter
 * por defecto delega en `Applicant.createDraftTravelRequest` /
 * `confirmDraftTravelRequest` (flujos transaccionales legacy con workflow
 * snapshot + refund context).
 */
import type {
  CreateTravelRequestInput,
  RequestId,
  UserId,
} from "~/contexts/travel-requests/domain/entities/Request.js";

export type DraftTravelRequest = { requestId: number };

export interface TravelRequestDraftWriter {
  createDraft(
    userId: UserId,
    partial: Partial<CreateTravelRequestInput>,
  ): Promise<DraftTravelRequest>;
  confirmDraft(userId: UserId, requestId: RequestId): Promise<DraftTravelRequest>;
}
