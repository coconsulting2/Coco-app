// @ts-nocheck — bulk-converted legacy; typed properly is M9 follow-up
/**
 * @module policyExceptionService
 * @description Excepciones a políticas de viáticos solicitadas y resueltas
 * (M2-006 RF-44, RF-45). Crear excepción: solicitante con justificación
 * obligatoria (>=10 chars). Decidir: solo aprobador designado en
 * Request.workflowPreSnapshot con permiso `expense:authorize_exception`.
 *
 * Refactor Fase 6: prisma extraído a policyExceptionQueries.js.
 */
import { createNotification } from "~/contexts/notifications/application/notificationService.js";
import {
  findRequestForException,
  createPolicyException,
  findExceptionWithRequest,
  decideExceptionTx,
  findPendingExceptionsForRequest,
  findAllPendingExceptions,
} from "~/contexts/policies/infrastructure/policyExceptionQueries.js";

const MIN_JUSTIFICATION_LEN = 10;

function authorizerIdsFromSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return [];
  const ids = [];
  if (snapshot.n1UserId) ids.push(Number(snapshot.n1UserId));
  if (snapshot.n2UserId) ids.push(Number(snapshot.n2UserId));
  return ids;
}

/**
 * Creates a PENDING exception and notifies designated approvers.
 *
 * @param {{
 *   requestId: number,
 *   receiptId?: number,
 *   policyId?: number,
 *   capId?: number,
 *   amountClaimed: number,
 *   amountAllowed?: number,
 *   excessAmount: number,
 *   justification: string,
 *   requestedById: number
 * }} payload
 */
export async function createException(payload) {
  if (
    !payload.justification ||
    String(payload.justification).trim().length < MIN_JUSTIFICATION_LEN
  ) {
    const err = new Error(`Justificación requerida (mínimo ${MIN_JUSTIFICATION_LEN} caracteres).`);
    err.status = 400;
    throw err;
  }
  if (!payload.requestId || !payload.requestedById) {
    const err = new Error("requestId y requestedById son requeridos.");
    err.status = 400;
    throw err;
  }

  const request = await findRequestForException(payload.requestId);
  if (!request) {
    const err = new Error(`Solicitud ${payload.requestId} no encontrada.`);
    err.status = 404;
    throw err;
  }

  const created = await createPolicyException({
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
    await createNotification(
      userId,
      `Nueva excepción de política para solicitud #${request.requestId}: $${Number(payload.excessAmount).toFixed(2)} sobre el tope.`,
    ).catch(() => null);
  }

  return created;
}

/**
 * Decides an exception (APPROVED or REJECTED) y aplica efectos colaterales.
 *
 * @param {number} exceptionId
 * @param {"APPROVED" | "REJECTED"} decision
 * @param {number} decidedById
 * @param {string} [decisionNote]
 */
export async function decideException(exceptionId, decision, decidedById, decisionNote = null) {
  if (decision !== "APPROVED" && decision !== "REJECTED") {
    const err = new Error("Decisión inválida; usar APPROVED o REJECTED.");
    err.status = 400;
    throw err;
  }
  const exception = await findExceptionWithRequest(exceptionId);
  if (!exception) {
    const err = new Error(`Excepción ${exceptionId} no encontrada.`);
    err.status = 404;
    throw err;
  }
  if (exception.status !== "PENDING") {
    const err = new Error("Esta excepción ya fue decidida y no puede modificarse.");
    err.status = 400;
    throw err;
  }

  const allowedApprovers = authorizerIdsFromSnapshot(exception.request.workflowPreSnapshot);
  if (allowedApprovers.length > 0 && !allowedApprovers.includes(Number(decidedById))) {
    const err = new Error(
      "Solo los aprobadores designados de la solicitud pueden decidir esta excepción.",
    );
    err.status = 403;
    throw err;
  }

  const accion = decision === "APPROVED" ? "APROBADO" : "RECHAZADO";
  const refundFlag = decision === "APPROVED";
  const note = decisionNote ? String(decisionNote).trim() : null;

  const updated = await decideExceptionTx({
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
    await createNotification(
      exception.request.userId,
      `Tu excepción de política para solicitud #${exception.requestId} fue ${verb}.`,
    ).catch(() => null);
  }

  return updated;
}

/**
 * @param {number} requestId
 */
export async function listPendingForRequest(requestId) {
  return findPendingExceptionsForRequest(requestId);
}

/**
 * Lists exceptions pending an approver decision.
 *
 * @param {number} approverUserId
 */
export async function listPendingForApprover(approverUserId) {
  const all = await findAllPendingExceptions();
  return all.filter((ex) => {
    const approvers = authorizerIdsFromSnapshot(ex.request.workflowPreSnapshot);
    return approvers.length === 0 || approvers.includes(Number(approverUserId));
  });
}
