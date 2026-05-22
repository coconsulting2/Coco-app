/**
 * @module index
 * @description API pública del slice travel-agency.
 */

export type { AgencyAttention } from "~/contexts/travel-agency/domain/entities/AgencyAttention";
export type { AgencyRepository } from "~/contexts/travel-agency/domain/ports/AgencyRepository";
export { TravelAgencyError, AttentionNotFoundError, InvalidQuoteError } from "~/contexts/travel-agency/domain/errors";

// @ts-ignore — JS module
export { attendTravelRequest, getRequestsForAgent } from "~/contexts/travel-agency/application/travelAgentService.js";
