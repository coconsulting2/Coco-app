/**
 * @module PrismaTravelRequestCanceller
 * @description Adapter del port `TravelRequestCanceller`. Delega en
 * `Applicant.getRequestStatus` / `cancelTravelRequest`.
 */
import Applicant from "~/contexts/travel-requests/infrastructure/applicantModel.js";
import type { TravelRequestCanceller } from "~/contexts/travel-requests/domain/ports/TravelRequestCanceller.js";

export class PrismaTravelRequestCanceller implements TravelRequestCanceller {
  async getRequestStatus(requestId: number): Promise<number | null> {
    const status = (await Applicant.getRequestStatus(requestId)) as number | null;
    return status === null || status === undefined ? null : Number(status);
  }

  async cancel(requestId: number): Promise<void> {
    await Applicant.cancelTravelRequest(requestId);
  }
}
