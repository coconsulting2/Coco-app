/**
 * @module reassignApproval
 * @description Use-case: reasigna N1 o N2 en el snapshot del workflow sin
 * cambiar el status. Requiere motivo + usuario destino con rol N1/N2.
 */
import type {
  AuthorizerRepository,
  WorkflowPreSnapshot,
} from "~/contexts/approvals/domain/ports/AuthorizerRepository.js";
import {
  ApprovalNotFoundError,
  NotAuthorizedToApproveError,
  RequestNotInAuthorizationStatusError,
  ReassignmentTargetInvalidError,
} from "~/contexts/approvals/domain/errors.js";

export type ReassignApprovalInput = {
  requestId: number;
  actorUserId: number;
  targetUserId: number;
  motivo: string;
};

export type ReassignApprovalResult = { message: string };

export type ReassignApprovalDeps = {
  authorizerRepo: AuthorizerRepository;
};

function authorizerMatchesTier(
  snapshot: WorkflowPreSnapshot | null,
  tier: 1 | 2,
  authorId: number,
  roleName: string | null,
): boolean {
  const key = tier === 1 ? "n1UserId" : "n2UserId";
  const designated =
    snapshot && typeof snapshot === "object" ? (snapshot[key] as number | null | undefined) : null;
  if (designated != null) {
    return Number(designated) === Number(authorId);
  }
  if (tier === 1) return roleName === "N1";
  if (tier === 2) return roleName === "N2";
  return false;
}

export async function reassignApproval(
  input: ReassignApprovalInput,
  deps: ReassignApprovalDeps,
): Promise<ReassignApprovalResult> {
  const m = typeof input.motivo === "string" ? input.motivo.trim() : "";
  if (!m) throw new ReassignmentTargetInvalidError("El motivo es obligatorio");

  const tid = Number(input.targetUserId);
  if (!Number.isFinite(tid) || tid < 1) {
    throw new ReassignmentTargetInvalidError("Usuario destino inválido");
  }
  if (tid === Number(input.actorUserId)) {
    throw new ReassignmentTargetInvalidError(
      "No puede reasignar la tarea al mismo usuario",
    );
  }

  const ctx = await deps.authorizerRepo.getRequestAuthorizationContext(input.requestId);
  if (!ctx) throw new ApprovalNotFoundError("Request not found");

  const actorRole = await deps.authorizerRepo.getUserRoleName(input.actorUserId);
  if (!actorRole) throw new ApprovalNotFoundError("User not found");

  const targetRole = await deps.authorizerRepo.getUserRoleName(tid);
  if (!targetRole || !["N1", "N2"].includes(targetRole)) {
    throw new ReassignmentTargetInvalidError(
      "El usuario destino debe tener rol N1 o N2",
    );
  }

  const snap: WorkflowPreSnapshot =
    ctx.workflowPreSnapshot && typeof ctx.workflowPreSnapshot === "object"
      ? { ...ctx.workflowPreSnapshot }
      : {};
  const levels =
    Array.isArray(snap.levels) && snap.levels.length > 0 ? snap.levels : [1, 2];

  if (ctx.requestStatusId === 2) {
    if (
      !authorizerMatchesTier(ctx.workflowPreSnapshot, 1, input.actorUserId, actorRole) ||
      !levels.includes(1)
    ) {
      throw new NotAuthorizedToApproveError(
        "Solo el aprobador asignado a esta etapa puede reasignar",
      );
    }
    snap.n1UserId = tid;
  } else if (ctx.requestStatusId === 3) {
    if (
      !authorizerMatchesTier(ctx.workflowPreSnapshot, 2, input.actorUserId, actorRole) ||
      !levels.includes(2)
    ) {
      throw new NotAuthorizedToApproveError(
        "Solo el aprobador asignado a esta etapa puede reasignar",
      );
    }
    snap.n2UserId = tid;
  } else {
    throw new RequestNotInAuthorizationStatusError();
  }

  const comentario = `Reasignado a usuario ${tid}. ${m}`;
  await deps.authorizerRepo.applyWorkflowAction(
    input.requestId,
    { statusId: ctx.requestStatusId, workflowPreSnapshot: snap },
    input.actorUserId,
    "REASIGNADO",
    comentario,
  );

  return { message: "Tarea reasignada correctamente" };
}
