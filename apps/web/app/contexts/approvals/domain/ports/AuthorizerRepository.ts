/**
 * @module AuthorizerRepository
 * @description Port del repositorio de autorización. Encapsula las queries y
 * mutaciones que el use-case necesita: lookup del contexto del request, rol
 * del actor, tope de aprobación por rol, y la transición atómica de status +
 * solicitud_historial.
 */

export type RequestAuthorizationContext = {
  requestStatusId: number;
  workflowPreSnapshot: WorkflowPreSnapshot | null;
  requestedFee: number | null;
  userId: number | null;
};

export type WorkflowPreSnapshot = {
  n1UserId?: number | null;
  n2UserId?: number | null;
  levels?: number[];
  // Permite campos adicionales del snapshot legacy.
  [key: string]: unknown;
};

export type WorkflowAction =
  | "APROBADO"
  | "RECHAZADO"
  | "ESCALADO"
  | "REASIGNADO"
  | "ACTUALIZADO";

export type WorkflowActionPatch = {
  statusId: number;
  workflowPreSnapshot?: WorkflowPreSnapshot | null;
};

export type AlertItem = {
  alert_id: number;
  user_name: string | undefined;
  request_id: number | null;
  message_text: string | undefined;
  alert_date: string;
  alert_time: string;
};

export type GetAlertsForAuthorizerInput = {
  authorizerUserId: number;
  roleName: "N1" | "N2";
  statusId: number;
  departmentId?: number | null;
  limit: number;
};

export interface AuthorizerRepository {
  getRequestAuthorizationContext(
    requestId: number,
  ): Promise<RequestAuthorizationContext | null>;

  getUserRoleName(userId: number): Promise<string | null>;

  getUserMaxApprovalAmount(userId: number): Promise<number | null>;

  applyWorkflowAction(
    requestId: number,
    patch: WorkflowActionPatch,
    actorUserId: number,
    accion: WorkflowAction,
    comentario?: string | null,
  ): Promise<void>;

  getAlertsForAuthorizer(input: GetAlertsForAuthorizerInput): Promise<AlertItem[]>;
}
