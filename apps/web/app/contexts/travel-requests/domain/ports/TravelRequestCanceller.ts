/**
 * @module TravelRequestCanceller
 * @description Puerto cohesivo para cancelar una solicitud. Expone el status
 * actual (para validar la transición legal) y la cancelación efectiva
 * (status → 9). El adapter delega en `Applicant.getRequestStatus` /
 * `cancelTravelRequest`.
 */
export interface TravelRequestCanceller {
  getRequestStatus(requestId: number): Promise<number | null>;
  cancel(requestId: number): Promise<void>;
}
