/**
 * @module index
 * @description API pública del slice travel-requests. Otros slices y las
 * routes importan SOLO desde aquí. No profundizan en application/ o
 * infrastructure/.
 */

// ── Domain types ──────────────────────────────────────────────────────────
export type {
  RequestId,
  UserId,
  RequestStatus,
  RouteLeg,
  TravelRequestSummary,
  TravelRequestDetail,
  CreateTravelRequestInput,
  EditTravelRequestInput,
} from "~/contexts/travel-requests/domain/entities/Request";

export type { RequestRepository } from "~/contexts/travel-requests/domain/ports/RequestRepository";

export {
  TravelRequestError,
  RequestNotFoundError,
  InvalidStatusTransitionError,
  RequestNotCancellableError,
  DuplicateCfdiError,
} from "~/contexts/travel-requests/domain/errors";

// ── Use-cases públicos ────────────────────────────────────────────────────
// @ts-ignore — JS module
export {
  listCompletedRequests,
  listActiveRequests,
  listDrafts,
  getRequestDetail,
  getCostCenterForUser,
} from "~/contexts/travel-requests/application/applicantQueryService.js";

// Use-cases de mutación expuestos desde el service legacy.
// @ts-ignore
export {
  formatRoutes,
  getRequestDays,
  cancelTravelRequestValidation,
  createExpenseValidationBatch,
  sendReceiptsForValidation,
} from "~/contexts/travel-requests/application/applicantService.js";
