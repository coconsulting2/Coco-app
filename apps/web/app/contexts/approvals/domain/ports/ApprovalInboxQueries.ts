/**
 * @module ApprovalInboxQueries
 * @description Port para queries de la bandeja del aprobador. Lee solicitudes
 * en status 2 (Primera Revisión, N1) y 3 (Segunda Revisión, N2) cuyo
 * `workflowPreSnapshot.{n1UserId,n2UserId}` coincide con el actor.
 *
 * Opcionalmente, en `WORKFLOW_APPROVAL_MODE=hierarchy`, incluye solicitudes
 * sin snapshot cuyo solicitante esté a la profundidad correcta dentro de la
 * cadena `managerUserId` del aprobador.
 */

export type ApprovalInboxItem = {
  requestId: number;
  userId: number | null;
  destinationCountry: string | null;
  beginningDate: Date | null;
  endingDate: Date | null;
  requestStatus: string;
  requesterName?: string | null;
  departmentName?: string | null;
};

export type ApprovalInboxQueryOpts = {
  organizationId?: bigint | number | string | null;
  n?: number | null;
};

export interface ApprovalInboxQueries {
  /**
   * Lee la bandeja del aprobador.
   * @param actorUserId userId del aprobador.
   * @param statusId 2 (N1) o 3 (N2).
   */
  findByApprover(
    actorUserId: number,
    statusId: 2 | 3,
    opts?: ApprovalInboxQueryOpts,
  ): Promise<ApprovalInboxItem[]>;
}
