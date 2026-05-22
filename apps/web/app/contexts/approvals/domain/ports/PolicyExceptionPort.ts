/**
 * @module PolicyExceptionPort
 * @description Port que approvals usa para preguntar si una solicitud tiene
 * excepciones de política pendientes (bloquea aprobación). Implementado por
 * el slice `policies/`.
 */
export type PolicyException = {
  id: number;
  status: string;
  // Campos legacy adicionales.
  [key: string]: unknown;
};

export interface PolicyExceptionPort {
  listPendingForRequest(requestId: number): Promise<PolicyException[]>;
  decideException(
    exceptionId: number,
    decision: "APPROVED" | "REJECTED",
    userId: number,
    note: string | null,
  ): Promise<unknown>;
}
