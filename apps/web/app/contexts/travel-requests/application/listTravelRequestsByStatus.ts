/**
 * @module listTravelRequestsByStatus
 * @description Use-cases puros (DI por parámetro) que listan solicitudes
 * por status ids. Dos variantes:
 *  - `listByStatusIds`: todas las solicitudes con status en el set
 *    (bandejas role-agnostic: Agencia status 5+9, CxP status 6/7/8).
 *  - `listByUserAndStatusIds`: solicitudes de UN usuario en el set
 *    (dashboard del Solicitante en comprobaciones).
 */
import type {
  TravelRequestAdminQueries,
  TravelRequestSummaryByDept,
} from "~/contexts/travel-requests/domain/ports/TravelRequestAdminQueries.js";

export type ListByStatusIdsInput = {
  statusIds: number[];
  limit?: number | null;
};

export type ListByUserAndStatusIdsInput = ListByStatusIdsInput & {
  userId: number;
};

export type ListByStatusDeps = { queries: TravelRequestAdminQueries };

export async function listByStatusIds(
  input: ListByStatusIdsInput,
  deps: ListByStatusDeps,
): Promise<TravelRequestSummaryByDept[]> {
  return deps.queries.findByStatusIds(input.statusIds, input.limit ?? null);
}

export async function listByUserAndStatusIds(
  input: ListByUserAndStatusIdsInput,
  deps: ListByStatusDeps,
): Promise<TravelRequestSummaryByDept[]> {
  return deps.queries.findByUserAndStatusIds(
    input.userId,
    input.statusIds,
    input.limit ?? null,
  );
}
