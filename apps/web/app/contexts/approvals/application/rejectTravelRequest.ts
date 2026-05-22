/**
 * @module rejectTravelRequest
 * @description Use-case: rechaza una solicitud en status 2 o 3 (N1 o N2).
 * Requiere comentario. Set status = 10 (Rechazado) + registra histórico.
 */
import type {
  AuthorizerRepository,
  RequestAuthorizationContext,
  WorkflowPreSnapshot,
} from "~/contexts/approvals/domain/ports/AuthorizerRepository.js";
import type { EmployeeHierarchyPort } from "~/contexts/approvals/domain/ports/EmployeeHierarchyPort.js";
import {
  ApprovalNotFoundError,
  NotAuthorizedToApproveError,
  RequestNotInAuthorizationStatusError,
  RejectionReasonRequiredError,
} from "~/contexts/approvals/domain/errors.js";

export type RejectTravelRequestInput = {
  requestId: number;
  actorUserId: number;
  comentario: string;
  useHierarchy?: boolean;
};

export type RejectTravelRequestResult = {
  newStatusId: 10;
  newStatusLabel: "Rechazado";
};

export type RejectTravelRequestDeps = {
  authorizerRepo: AuthorizerRepository;
  employeeHierarchy: EmployeeHierarchyPort;
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

function snapshotLevels(snap: WorkflowPreSnapshot | null): number[] {
  if (snap && typeof snap === "object" && Array.isArray(snap.levels)) {
    return snap.levels;
  }
  return [1, 2];
}

function useHierarchyApprovalMode(override?: boolean): boolean {
  if (override !== undefined) return override;
  return String(process.env.WORKFLOW_APPROVAL_MODE ?? "").toLowerCase() === "hierarchy";
}

function ensureTierForDecline(
  ctx: RequestAuthorizationContext,
  userId: number,
  roleName: string | null,
): void {
  const snap = ctx.workflowPreSnapshot;
  const levels = snapshotLevels(snap);
  if (ctx.requestStatusId === 2) {
    if (!authorizerMatchesTier(snap, 1, userId, roleName) || !levels.includes(1)) {
      throw new NotAuthorizedToApproveError(
        "User role not authorized to decline request at this stage",
      );
    }
  } else if (ctx.requestStatusId === 3) {
    if (!authorizerMatchesTier(snap, 2, userId, roleName) || !levels.includes(2)) {
      throw new NotAuthorizedToApproveError(
        "User role not authorized to decline request at this stage",
      );
    }
  } else {
    throw new RequestNotInAuthorizationStatusError();
  }
}

async function expectedApproverByHierarchy(
  ctx: RequestAuthorizationContext,
  deps: Pick<RejectTravelRequestDeps, "employeeHierarchy">,
): Promise<number | null> {
  if (ctx.userId == null) return null;
  const chain = await deps.employeeHierarchy.getApprovalChain(Number(ctx.userId), 4);
  if (ctx.requestStatusId === 2) return chain[0] ?? null;
  if (ctx.requestStatusId === 3) return chain[1] ?? null;
  return null;
}

export async function rejectTravelRequest(
  input: RejectTravelRequestInput,
  deps: RejectTravelRequestDeps,
): Promise<RejectTravelRequestResult> {
  const trimmed = typeof input.comentario === "string" ? input.comentario.trim() : "";
  if (!trimmed) throw new RejectionReasonRequiredError();

  const ctx = await deps.authorizerRepo.getRequestAuthorizationContext(input.requestId);
  if (!ctx) throw new ApprovalNotFoundError("Request not found");

  const roleName = await deps.authorizerRepo.getUserRoleName(input.actorUserId);
  if (!roleName) throw new ApprovalNotFoundError("User not found");

  if (!["N1", "N2"].includes(roleName)) {
    throw new NotAuthorizedToApproveError("User role not authorized to decline request");
  }

  const useHierarchy = useHierarchyApprovalMode(input.useHierarchy);
  if (useHierarchy) {
    const tier = ctx.requestStatusId === 2 ? 1 : ctx.requestStatusId === 3 ? 2 : null;
    if (!tier) throw new RequestNotInAuthorizationStatusError();
    const expected = await expectedApproverByHierarchy(ctx, deps);
    const canAct =
      expected != null
        ? Number(expected) === Number(input.actorUserId)
        : authorizerMatchesTier(ctx.workflowPreSnapshot, tier, input.actorUserId, roleName);
    if (!canAct) {
      throw new NotAuthorizedToApproveError(
        "User role not authorized to decline request at this stage",
      );
    }
  } else {
    ensureTierForDecline(ctx, input.actorUserId, roleName);
  }

  await deps.authorizerRepo.applyWorkflowAction(
    input.requestId,
    { statusId: 10 },
    input.actorUserId,
    "RECHAZADO",
    trimmed,
  );

  return { newStatusId: 10, newStatusLabel: "Rechazado" };
}
