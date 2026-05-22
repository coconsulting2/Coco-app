/**
 * @module getTravelRequestDetail
 * @description Use-cases para queries administrativas/legacy de travel-requests.
 * Reciben `TravelRequestAdminQueries` por DI.
 */
import type {
  TravelRequestAdminQueries,
  TravelRequestDetailRow,
  TravelRequestSummaryByDept,
} from "~/contexts/travel-requests/domain/ports/TravelRequestAdminQueries.js";

export type GetTravelRequestDetailDeps = { queries: TravelRequestAdminQueries };

export async function getTravelRequestDetail(
  requestId: number,
  deps: GetTravelRequestDetailDeps,
): Promise<TravelRequestDetailRow[]> {
  return deps.queries.findByIdWithRoutes(requestId);
}

export async function listTravelRequestsByDeptStatus(
  deptId: number,
  statusId: number,
  limit: number | null,
  deps: GetTravelRequestDetailDeps,
): Promise<TravelRequestSummaryByDept[]> {
  return deps.queries.findByDeptStatus(deptId, statusId, limit);
}
