/**
 * @module authorizeTravelRequest
 * @description Use-case del slice approvals: aprueba una solicitud en status
 * 2 (N1) o 3 (N2). Lógica:
 *   1. Lee el contexto autorizable (status, snapshot, monto).
 *   2. Verifica que el actor puede actuar en el tier actual (snapshot o
 *      jerarquía según `WORKFLOW_APPROVAL_MODE`).
 *   3. Bloquea si hay excepciones de política pendientes (RF-45).
 *   4. Si monto > tope del aprobador: escala a tier siguiente (status 3)
 *      o falla si no hay más niveles.
 *   5. Aplica transición atómica de status + solicitud_historial.
 *   6. Emite póliza AV si el nuevo status es 4 (aprobación final).
 *
 * Recibe todas las dependencias por DI. No conoce Prisma, env vars, ni
 * cross-slice services.
 */
import type {
  AuthorizerRepository,
  RequestAuthorizationContext,
  WorkflowPreSnapshot,
} from "~/contexts/approvals/domain/ports/AuthorizerRepository.js";
import type { WorkflowRulesPort } from "~/contexts/approvals/domain/ports/WorkflowRulesPort.js";
import type { PolicyExceptionPort } from "~/contexts/approvals/domain/ports/PolicyExceptionPort.js";
import type { AnticipoPolizaPort } from "~/contexts/approvals/domain/ports/AnticipoPolizaPort.js";
import type { EmployeeHierarchyPort } from "~/contexts/approvals/domain/ports/EmployeeHierarchyPort.js";
import {
  ApprovalNotFoundError,
  NotAuthorizedToApproveError,
  RequestNotInAuthorizationStatusError,
  AmountExceedsLimitNoEscalationError,
  AmountExceedsTopLimitError,
  PendingPolicyExceptionsError,
} from "~/contexts/approvals/domain/errors.js";

export type AuthorizeTravelRequestInput = {
  requestId: number;
  actorUserId: number;
  /** Override del WORKFLOW_APPROVAL_MODE. Si no se pasa, lee env var. */
  useHierarchy?: boolean;
};

export type AuthorizeTravelRequestResult = {
  newStatusId: number;
  newStatusLabel: string;
  outcome: "APROBADO" | "ESCALADO";
};

export type AuthorizeTravelRequestDeps = {
  authorizerRepo: AuthorizerRepository;
  workflowRules: WorkflowRulesPort;
  policyExceptions: PolicyExceptionPort;
  anticipoPoliza: AnticipoPolizaPort;
  employeeHierarchy: EmployeeHierarchyPort;
};

function labelForStatusId(statusId: number): string {
  if (statusId === 3) return "Segunda Revisión";
  if (statusId === 4) return "Cotización del Viaje";
  if (statusId === 10) return "Rechazado";
  return "Actualizado";
}

function requestAmount(ctx: RequestAuthorizationContext): number {
  return ctx.requestedFee == null ? 0 : Number(ctx.requestedFee);
}

function amountExceedsLimit(amount: number, maxAmount: number | null): boolean {
  if (maxAmount == null) return false;
  return Number(amount) > Number(maxAmount);
}

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

async function expectedApproverByHierarchy(
  ctx: RequestAuthorizationContext,
  deps: Pick<AuthorizeTravelRequestDeps, "employeeHierarchy">,
): Promise<number | null> {
  if (ctx.userId == null) return null;
  const chain = await deps.employeeHierarchy.getApprovalChain(Number(ctx.userId), 4);
  if (ctx.requestStatusId === 2) return chain[0] ?? null;
  if (ctx.requestStatusId === 3) return chain[1] ?? null;
  return null;
}

async function canActOnTier(
  ctx: RequestAuthorizationContext,
  tier: 1 | 2,
  userId: number,
  roleName: string | null,
  deps: Pick<AuthorizeTravelRequestDeps, "employeeHierarchy">,
  useHierarchy: boolean,
): Promise<boolean> {
  if (useHierarchy) {
    const expected = await expectedApproverByHierarchy(ctx, deps);
    if (expected != null) return Number(expected) === Number(userId);
  }
  return authorizerMatchesTier(ctx.workflowPreSnapshot, tier, userId, roleName);
}

async function emitAnticipoPolizaIfApproved(
  requestId: number,
  newStatusId: number,
  deps: Pick<AuthorizeTravelRequestDeps, "anticipoPoliza">,
): Promise<void> {
  if (Number(newStatusId) !== 4) return;
  try {
    await deps.anticipoPoliza.onTravelRequestFullyApproved(requestId);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      "emitAnticipoPolizaIfApproved:",
      err instanceof Error ? err.message : err,
    );
  }
}

async function ensureNoPendingPolicyExceptions(
  requestId: number,
  deps: Pick<AuthorizeTravelRequestDeps, "policyExceptions">,
): Promise<void> {
  try {
    const pending = await deps.policyExceptions.listPendingForRequest(requestId);
    if (pending && pending.length > 0) {
      throw new PendingPolicyExceptionsError();
    }
  } catch (err) {
    if (err instanceof PendingPolicyExceptionsError) throw err;
    // Defense-in-depth: si el chequeo de infra falla, no bloqueamos la
    // aprobación (el chequeo es preventivo, no autoridad final).
    // eslint-disable-next-line no-console
    console.warn(
      "authorizeTravelRequest: pending exception check failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

export async function authorizeTravelRequest(
  input: AuthorizeTravelRequestInput,
  deps: AuthorizeTravelRequestDeps,
): Promise<AuthorizeTravelRequestResult> {
  const { requestId, actorUserId } = input;

  const ctx = await deps.authorizerRepo.getRequestAuthorizationContext(requestId);
  if (!ctx) throw new ApprovalNotFoundError("Request not found");

  const roleName = await deps.authorizerRepo.getUserRoleName(actorUserId);
  if (!roleName) throw new ApprovalNotFoundError("User not found");

  await ensureNoPendingPolicyExceptions(requestId, deps);

  const levels = snapshotLevels(ctx.workflowPreSnapshot);
  const amount = requestAmount(ctx);
  const maxAmount = await deps.authorizerRepo.getUserMaxApprovalAmount(actorUserId);
  const useHierarchy = useHierarchyApprovalMode(input.useHierarchy);

  if (ctx.requestStatusId === 2) {
    const canAct = await canActOnTier(ctx, 1, actorUserId, roleName, deps, useHierarchy);
    if (!canAct || !levels.includes(1)) {
      throw new NotAuthorizedToApproveError(
        "User role not authorized to approve request at this stage",
      );
    }
    if (amountExceedsLimit(amount, maxAmount)) {
      if (!levels.includes(2)) {
        throw new AmountExceedsLimitNoEscalationError();
      }
      await deps.authorizerRepo.applyWorkflowAction(
        requestId,
        { statusId: 3 },
        actorUserId,
        "ESCALADO",
        null,
      );
      return { newStatusId: 3, newStatusLabel: labelForStatusId(3), outcome: "ESCALADO" };
    }
    const newStatusId = deps.workflowRules.statusAfterN1Approval(levels);
    await deps.authorizerRepo.applyWorkflowAction(
      requestId,
      { statusId: newStatusId },
      actorUserId,
      "APROBADO",
      null,
    );
    await emitAnticipoPolizaIfApproved(requestId, newStatusId, deps);
    return { newStatusId, newStatusLabel: labelForStatusId(newStatusId), outcome: "APROBADO" };
  }

  if (ctx.requestStatusId === 3) {
    const canAct = await canActOnTier(ctx, 2, actorUserId, roleName, deps, useHierarchy);
    if (!canAct || !levels.includes(2)) {
      throw new NotAuthorizedToApproveError(
        "User role not authorized to approve request at this stage",
      );
    }
    if (amountExceedsLimit(amount, maxAmount)) {
      throw new AmountExceedsTopLimitError();
    }
    const newStatusId = deps.workflowRules.statusAfterN2Approval();
    await deps.authorizerRepo.applyWorkflowAction(
      requestId,
      { statusId: newStatusId },
      actorUserId,
      "APROBADO",
      null,
    );
    await emitAnticipoPolizaIfApproved(requestId, newStatusId, deps);
    return { newStatusId, newStatusLabel: labelForStatusId(newStatusId), outcome: "APROBADO" };
  }

  throw new RequestNotInAuthorizationStatusError();
}
