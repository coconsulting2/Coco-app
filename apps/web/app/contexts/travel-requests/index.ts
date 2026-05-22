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
} from "~/contexts/travel-requests/domain/errors";

// ── Use-cases legacy (pending hexagonal refactor) ─────────────────────────
// @ts-ignore — JS module
export {
  listCompletedRequests,
  listActiveRequests,
  listDrafts,
  getRequestDetail,
  getCostCenterForUser,
} from "~/contexts/travel-requests/application/applicantQueryService.js";

// @ts-ignore — JS module (pending hexagonal refactor)
export {
  formatRoutes,
  getRequestDays,
  cancelTravelRequestValidation,
  createExpenseValidationBatch,
  sendReceiptsForValidation,
} from "~/contexts/travel-requests/application/applicantService.js";

// ── Use-cases hexagonal (DI por composition root) ────────────────────────
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
