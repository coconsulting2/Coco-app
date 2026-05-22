/**
 * @module TravelRequestAdminQueries
 * @description Port para queries administrativas/legacy de travel-requests
 * que devuelven shapes denormalizadas (un row por ruta) consumidas por el
 * api dispatcher `/api/user/get-travel-request/*` y vistas legacy.
 *
 * Diferente del `RequestRepository`: éste devuelve domain entities; este port
 * sirve queries denormalizadas para serialización HTTP del contrato Swagger.
 */

export type TravelRequestDetailRow = {
  requestId: number;
  requestStatus: string;
  notes: string | null;
  requestedFee: number | null;
  imposedFee: number | null;
  requestDays: number | null;
  creationDate: Date;
  userName: string | null;
  userEmail: string | null;
  userPhoneNumber: string | null;
  routerIndex: number | null;
  originCountry: string | null;
  originCity: string | null;
  destinationCountry: string | null;
  destinationCity: string | null;
  beginningDate: Date | null;
  beginningTime: Date | null;
  endingDate: Date | null;
  endingTime: Date | null;
  hotelNeeded: boolean | null;
  planeNeeded: boolean | null;
};

export type TravelRequestSummaryByDept = {
  requestId: number;
  userId: number | null;
  destinationCountry: string | null;
  beginningDate: Date | null;
  endingDate: Date | null;
  requestStatus: string;
};

export interface TravelRequestAdminQueries {
  /**
   * Devuelve la solicitud con un row por ruta (legacy shape). Si no tiene
   * rutas, devuelve un row con campos de ruta en null.
   */
  findByIdWithRoutes(requestId: number): Promise<TravelRequestDetailRow[]>;

  /**
   * Lista por departamento + status. @deprecated Usar bandeja de aprobador
   * basada en workflow snapshot (approvals slice).
   */
  findByDeptStatus(
    deptId: number,
    statusId: number,
    limit?: number | null,
  ): Promise<TravelRequestSummaryByDept[]>;
}
