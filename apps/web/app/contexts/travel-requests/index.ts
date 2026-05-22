/**
 * @module travel-requests (slice public API)
 * @description Convertido a TS en sesión E — cero `@ts-ignore` aquí.
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
} from "~/contexts/travel-requests/domain/entities/Request.js";

export type { RequestRepository } from "~/contexts/travel-requests/domain/ports/RequestRepository.js";
export type {
  TravelRequestAdminQueries,
  TravelRequestDetailRow,
  TravelRequestSummaryByDept,
} from "~/contexts/travel-requests/domain/ports/TravelRequestAdminQueries.js";

export {
  TravelRequestError,
  RequestNotFoundError,
  InvalidStatusTransitionError,
  RequestNotCancellableError,
  DuplicateCfdiError,
} from "~/contexts/travel-requests/domain/errors.js";

// ── Use-cases TS (sesión E) ──────────────────────────────────────────────
export {
  listCompletedRequests,
  listActiveRequests,
  listDrafts,
  getRequestDetail,
  getCostCenterForUser,
} from "~/contexts/travel-requests/application/applicantQueryService.js";

export {
  formatRoutes,
  getRequestDays,
  cancelTravelRequestValidation,
  createExpenseValidationBatch,
  sendReceiptsForValidation,
  getCountryId,
  getCityId,
  TravelRequestServiceError,
  type RouteInput,
  type ReceiptInput,
} from "~/contexts/travel-requests/application/applicantService.js";

export {
  buildSolicitudJourney,
  buildJourneyStepDefinitions,
  approvalLevelsFromSnapshot,
  routeNeedsAgency,
  type StepState,
  type JourneyStep,
  type JourneyStepDef,
  type HistorialEntry,
  type JourneyOutput,
} from "~/contexts/travel-requests/application/solicitudJourneyService.js";

export {
  requestAllowsReceiptUpload,
  assertRequestAllowsReceiptUpload,
  ReceiptUploadPolicyError,
  MIN_STATUS_FOR_RECEIPT_UPLOAD,
  MAX_STATUS_FOR_RECEIPT_UPLOAD,
} from "~/contexts/travel-requests/application/requestReceiptUploadPolicy.js";

// ── Hexagonal queries (admin views) ───────────────────────────────────────
import { PrismaTravelRequestAdminQueries } from "~/contexts/travel-requests/infrastructure/PrismaTravelRequestAdminQueries.js";
import * as detailModule from "~/contexts/travel-requests/application/getTravelRequestDetail.js";

const defaultAdminQueries = new PrismaTravelRequestAdminQueries();

export const getTravelRequestDetail = (requestId: number) =>
  detailModule.getTravelRequestDetail(requestId, { queries: defaultAdminQueries });

export const listTravelRequestsByDeptStatus = (
  deptId: number,
  statusId: number,
  limit: number | null = null,
) =>
  detailModule.listTravelRequestsByDeptStatus(deptId, statusId, limit, {
    queries: defaultAdminQueries,
  });

export const usecases = {
  getTravelRequestDetail: detailModule.getTravelRequestDetail,
  listTravelRequestsByDeptStatus: detailModule.listTravelRequestsByDeptStatus,
} as const;
