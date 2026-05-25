/**
 * @module RequestJourneyQueries (port)
 * @description Provee los insumos crudos que `buildSolicitudJourney` necesita
 * para reconstruir el recorrido de una solicitud (estado actual, snapshot de
 * workflow, rutas y el historial de aprobaciones/rechazos/escalamientos).
 *
 * El shape devuelto es directamente asignable a `BuildJourneyInput` del
 * use-case puro `solicitudJourneyService`.
 */

export type JourneyHistorialEntry = {
  accion: string;
  createdAt: Date;
  comentario?: string | null;
  user?: { userName?: string; role?: { roleName?: string } };
};

export type RequestJourneyData = {
  currentStatusId: number;
  currentStatusLabel: string;
  workflowPreSnapshot: unknown;
  routeRequests: Array<{ route: { hotelNeeded: boolean; planeNeeded: boolean } | null }>;
  creationDate: Date;
  historial: JourneyHistorialEntry[];
};

export interface RequestJourneyQueries {
  /** Devuelve los insumos del recorrido, o `null` si la solicitud no existe. */
  getJourneyData(requestId: number): Promise<RequestJourneyData | null>;
}
