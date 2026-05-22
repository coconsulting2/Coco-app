/**
 * @module travel-agency (slice public API + composition root)
 * @description Fachada del slice. La búsqueda de ofertas vive en
 * @coco/integrations/duffel y se re-exporta desde los slices flights/hotels.
 * Este slice se encarga de la transición de Agencia → Comprobación.
 *
 * NOTA: el legacy `travelAgentService.js` quedó vacío (0 LOC); su API
 * `attendTravelRequest`/`getRequestsForAgent` no era utilizable. Se
 * reemplaza por `markAttendedByAgency` (hexagonal proper). La query
 * de "requests para agencia" se cubre con
 * `listTravelRequestsByDeptStatus` del slice travel-requests.
 */

// ── Domain types + errores ────────────────────────────────────────────────
export type { AgencyAttention } from "~/contexts/travel-agency/domain/entities/AgencyAttention.js";
export type { AgencyRepository } from "~/contexts/travel-agency/domain/ports/AgencyRepository.js";
export type { AgencyAttendRepository } from "~/contexts/travel-agency/domain/ports/AgencyAttendRepository.js";
export {
  TravelAgencyError,
  AttentionNotFoundError,
  InvalidQuoteError,
} from "~/contexts/travel-agency/domain/errors.js";

// ── Composition root (default deps) ───────────────────────────────────────
import { PrismaAgencyAttendRepository } from "~/contexts/travel-agency/infrastructure/PrismaAgencyAttendRepository.js";
import * as markAttendedModule from "~/contexts/travel-agency/application/markAttended.js";

const defaultAttendRepo = new PrismaAgencyAttendRepository();

export const markAttendedByAgency = (
  input: markAttendedModule.MarkAttendedInput,
) =>
  markAttendedModule.markAttended(input, { attendRepo: defaultAttendRepo });

export const usecases = {
  markAttended: markAttendedModule.markAttended,
} as const;

export const adapters = {
  AgencyAttendRepository: PrismaAgencyAttendRepository,
} as const;
