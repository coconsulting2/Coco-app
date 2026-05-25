/**
 * @module policyExceptionService
 * @description Excepciones a políticas de viáticos solicitadas y resueltas
 * (M2-006 RF-44, RF-45). Crear excepción: solicitante con justificación
 * obligatoria (>=10 chars). Decidir: solo aprobador designado en
 * Request.workflowPreSnapshot con permiso `expense:authorize_exception`.
 * Recibe el puerto de queries por DI.
 */
import { createNotification } from "~/contexts/notifications";
import { prismaPolicyExceptionQueries } from "~/contexts/policies/infrastructure/policyExceptionQueries.js";
import type {
  PendingExceptionWithJoins,
  PolicyExceptionQueriesPort,
} from "~/contexts/policies/domain/ports/PolicyExceptionQueriesPort";
import {
  httpError,
  type PolicyExceptionRow,
  type WorkflowPreSnapshot,
} from "~/contexts/policies/domain/types";

const MIN_JUSTIFICATION_LEN = 10;

export interface PolicyExceptionServiceDeps {
  queries: PolicyExceptionQueriesPort;
  notify: (userId: number, message: string) => Promise<unknown>;
}

const defaultDeps: PolicyExceptionServiceDeps = {
  queries: prismaPolicyExceptionQueries,
  notify: createNotification,
};

export interface CreateExceptionPayload {
  requestId: number;
  receiptId?: number | null;
  policyId?: number | null;
  capId?: number | null;
  amountClaimed: number;
  amountAllowed?: number | null;
  excessAmount: number;
  justification: string;
  requestedById: number;
}

export type ExceptionDecision = "APPROVED" | "REJECTED";

function authorizerIdsFromSnapshot(snapshot: WorkflowPreSnapshot | null): number[] {
  if (!snapshot || typeof snapshot !== "object") return [];
  const ids: number[] = [];
  if (snapshot.n1UserId) ids.push(Number(snapshot.n1UserId));
  if (snapshot.n2UserId) ids.push(Number(snapshot.n2UserId));
  return ids;
}

/** Creates a PENDING exception and notifies designated approvers. */
export async function createException(
  payload: CreateExceptionPayload,
  deps: PolicyExceptionServiceDeps = defaultDeps,
): Promise<PolicyExceptionRow> {
  if (
    !payload.justification ||
    String(payload.justification).trim().length < MIN_JUSTIFICATION_LEN
  ) {
    throw httpError(
      `Justificación requerida (mínimo ${MIN_JUSTIFICATION_LEN} caracteres).`,
      400,
    );
  }
  if (!payload.requestId || !payload.requestedById) {
    throw httpError("requestId y requestedById son requeridos.", 400);
  }

  const request = await deps.queries.findRequestForException(payload.requestId);
  if (!request) {
    throw httpError(`Solicitud ${payload.requestId} no encontrada.`, 404);
  }

  const created = await deps.queries.createPolicyException({
    organizationId: request.organizationId,
    requestId: Number(payload.requestId),
    receiptId: payload.receiptId ? Number(payload.receiptId) : null,
    policyId: payload.policyId ? Number(payload.policyId) : null,
    capId: payload.capId ? Number(payload.capId) : null,
    amountClaimed: payload.amountClaimed,
    amountAllowed: payload.amountAllowed ?? null,
    excessAmount: payload.excessAmount,
    justification: String(payload.justification).trim(),
    status: "PENDING",
    requestedById: Number(payload.requestedById),
  });

  const approvers = authorizerIdsFromSnapshot(request.workflowPreSnapshot);
  for (const userId of approvers) {
    await deps
      .notify(
        userId,
        `Nueva excepción de política para solicitud #${request.requestId}: $${Number(payload.excessAmount).toFixed(2)} sobre el tope.`,
      )
      .catch(() => null);
  }

  return created;
}

/** Decides an exception (APPROVED or REJECTED) y aplica efectos colaterales. */
export async function decideException(
  exceptionId: number,
  decision: ExceptionDecision,
  decidedById: number,
  decisionNote: string | null = null,
  deps: PolicyExceptionServiceDeps = defaultDeps,
): Promise<PolicyExceptionRow> {
  if (decision !== "APPROVED" && decision !== "REJECTED") {
    throw httpError("Decisión inválida; usar APPROVED o REJECTED.", 400);
  }
  const exception = await deps.queries.findExceptionWithRequest(exceptionId);
  if (!exception) {
    throw httpError(`Excepción ${exceptionId} no encontrada.`, 404);
  }
  if (exception.status !== "PENDING") {
    throw httpError("Esta excepción ya fue decidida y no puede modificarse.", 400);
  }

  const allowedApprovers = authorizerIdsFromSnapshot(exception.request.workflowPreSnapshot);
  if (allowedApprovers.length > 0 && !allowedApprovers.includes(Number(decidedById))) {
    throw httpError(
      "Solo los aprobadores designados de la solicitud pueden decidir esta excepción.",
      403,
    );
  }

  const accion = decision === "APPROVED" ? "APROBADO" : "RECHAZADO";
  const refundFlag = decision === "APPROVED";
  const note = decisionNote ? String(decisionNote).trim() : null;

  const updated = await deps.queries.decideExceptionTx({
    exceptionId: Number(exceptionId),
    exceptionUpdate: {
      status: decision,
      decidedById: Number(decidedById),
      decidedAt: new Date(),
      decisionNote: note,
    },
    receiptId: exception.receiptId,
    refundFlag,
    requestId: exception.requestId,
    organizationId: exception.request.organizationId,
    decidedById: Number(decidedById),
    accion,
    comentario:
      `Excepción #${exception.exceptionId} (${decision}). ` +
      (note ? `Nota: ${note}` : "Sin nota."),
  });

  if (exception.request.userId) {
    const verb = decision === "APPROVED" ? "aprobada" : "rechazada";
    await deps
      .notify(
        exception.request.userId,
        `Tu excepción de política para solicitud #${exception.requestId} fue ${verb}.`,
      )
      .catch(() => null);
  }

  return updated;
}

/** Lista las excepciones PENDING de una solicitud. */
export async function listPendingForRequest(
  requestId: number,
  deps: PolicyExceptionServiceDeps = defaultDeps,
): Promise<PolicyExceptionRow[]> {
  return deps.queries.findPendingExceptionsForRequest(requestId);
}

/** Lists exceptions pending an approver decision. */
export async function listPendingForApprover(
  approverUserId: number,
  deps: PolicyExceptionServiceDeps = defaultDeps,
): Promise<PendingExceptionWithJoins[]> {
  const all = await deps.queries.findAllPendingExceptions();
  return all.filter((ex) => {
    const approvers = authorizerIdsFromSnapshot(ex.request.workflowPreSnapshot);
    return approvers.length === 0 || approvers.includes(Number(approverUserId));
  });
}

/** Lista todas las excepciones PENDING (sin filtrar por aprobador). */
export async function listExceptions(
  deps: PolicyExceptionServiceDeps = defaultDeps,
): Promise<PendingExceptionWithJoins[]> {
  return deps.queries.findAllPendingExceptions();
}

// ── Aliases de paridad con la API pública del slice ─────────────────────────
export const requestException = createException;
export const approveException = decideException;
