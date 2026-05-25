/**
 * @module getSolicitudJourney
 * @description Use-case: obtiene los insumos del recorrido vía el port
 * `RequestJourneyQueries` y los pipea al constructor puro
 * `buildSolicitudJourney`. DI por parámetro (gold standard).
 */
import {
  buildSolicitudJourney,
  type JourneyOutput,
} from "~/contexts/travel-requests/application/solicitudJourneyService.js";
import type { RequestJourneyQueries } from "~/contexts/travel-requests/domain/ports/RequestJourneyQueries.js";

export type GetSolicitudJourneyInput = { requestId: number };
export type GetSolicitudJourneyDeps = { journey: RequestJourneyQueries };

export async function getSolicitudJourney(
  input: GetSolicitudJourneyInput,
  deps: GetSolicitudJourneyDeps,
): Promise<JourneyOutput | null> {
  const data = await deps.journey.getJourneyData(input.requestId);
  if (!data) return null;

  return buildSolicitudJourney({
    currentStatusId: data.currentStatusId,
    currentStatusLabel: data.currentStatusLabel,
    workflowPreSnapshot: data.workflowPreSnapshot,
    routeRequests: data.routeRequests,
    creationDate: data.creationDate,
    historial: data.historial,
  });
}
