/**
 * @module ApproverDecisionHistoryQueries
 * @description Port para el HISTÓRICO de decisiones de un aprobador (N1/N2):
 * las solicitudes que ÉL ya aprobó / rechazó / reasignó / escaló, leídas desde
 * `solicitud_historial` (donde `userId` = el aprobador). Distinto de la bandeja
 * de pendientes (`ApprovalInboxQueries`).
 */

export type ApproverDecisionAction =
  | "APROBADO"
  | "RECHAZADO"
  | "ESCALADO"
  | "REASIGNADO";

export type ApproverDecisionHistoryItem = {
  historialId: number;
  requestId: number;
  action: ApproverDecisionAction;
  comentario: string | null;
  decidedAt: Date;
  destinationCountry: string | null;
  beginningDate: Date | null;
  endingDate: Date | null;
  requestStatus: string | null;
  requesterName: string | null;
};

export type ApproverDecisionHistoryOpts = {
  organizationId?: bigint | number | string | null;
  /** Límite de filas; `null` / `0` => sin límite. */
  n?: number | null;
};

export interface ApproverDecisionHistoryQueries {
  /**
   * Lee el histórico de decisiones tomadas por el aprobador, más reciente primero.
   * @param approverUserId userId del aprobador (actor de la decisión).
   */
  findByApprover(
    approverUserId: number,
    opts?: ApproverDecisionHistoryOpts,
  ): Promise<ApproverDecisionHistoryItem[]>;
}
