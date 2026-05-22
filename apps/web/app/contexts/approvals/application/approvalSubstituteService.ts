/**
 * @module approvalSubstituteService
 * @description Business rules para sustitutos y escalamiento automático.
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — platform/permissions legacy (pendiente refactor)
import { loadEffectivePermissions } from "~/platform/permissions/permission-service.server.js";
import ApprovalSubstituteModel, {
  type Substitute,
} from "~/contexts/approvals/infrastructure/approvalSubstituteModel.js";

export class ApprovalSubstituteError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(status: number, message: string, code = "APPROVALSUBSTITUTE") {
    super(message);
    this.name = "ApprovalSubstituteError";
    this.status = status;
    this.code = code;
  }
}

function parseDate(value: Date | string, fieldName: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new ApprovalSubstituteError(400, `${fieldName} inválido`);
  }
  return d;
}

async function ensureAuthorizerUser(userId: number): Promise<void> {
  const roleName = await ApprovalSubstituteModel.getUserRoleName(userId);
  if (!roleName) {
    throw new ApprovalSubstituteError(404, "Usuario no encontrado");
  }
  if (roleName === "Observador") {
    throw new ApprovalSubstituteError(
      400,
      "No se puede asignar un usuario de solo notificación como sustituto",
    );
  }
  const permissions = (await loadEffectivePermissions(Number(userId))) as string[];
  if (!permissions.includes("travel_request:authorize")) {
    throw new ApprovalSubstituteError(
      400,
      "El usuario sustituto no cuenta con permiso para autorizar",
    );
  }
}

export async function listSubstitutes(approverId: number): Promise<Substitute[]> {
  return ApprovalSubstituteModel.listByApprover(approverId);
}

export async function createSubstitute(
  approverId: number,
  substituteId: number,
  validFrom: Date | string,
  validTo: Date | string,
): Promise<Substitute | null> {
  const aid = Number(approverId);
  const sid = Number(substituteId);
  if (!Number.isFinite(sid) || sid < 1) {
    throw new ApprovalSubstituteError(400, "substitute_id inválido");
  }
  if (aid === sid) {
    throw new ApprovalSubstituteError(
      400,
      "El sustituto no puede ser el mismo aprobador",
    );
  }

  const from = parseDate(validFrom, "valid_from");
  const to = parseDate(validTo, "valid_to");
  if (to <= from) {
    throw new ApprovalSubstituteError(400, "valid_to debe ser mayor que valid_from");
  }

  await ensureAuthorizerUser(aid);
  await ensureAuthorizerUser(sid);

  return ApprovalSubstituteModel.createSubstitute({
    approverId: aid,
    substituteId: sid,
    validFrom: from,
    validTo: to,
  });
}

export async function deleteSubstitute(
  id: number,
  approverId: number,
): Promise<{ message: string }> {
  const deleted = await ApprovalSubstituteModel.deleteSubstitute(id, approverId);
  if (!deleted) {
    throw new ApprovalSubstituteError(404, "Sustituto no encontrado");
  }
  return { message: "Sustituto eliminado correctamente" };
}

function resolveAssignedApprover(
  requestStatusId: number,
  workflowPreSnapshot: { n1UserId?: number; n2UserId?: number } | null,
): { tier: 1 | 2 | null; approverId: number | null; snapshot: Record<string, unknown> } {
  const snap =
    workflowPreSnapshot && typeof workflowPreSnapshot === "object" ? workflowPreSnapshot : {};
  if (requestStatusId === 2) {
    return { tier: 1, approverId: Number((snap as { n1UserId?: number }).n1UserId), snapshot: { ...snap } };
  }
  if (requestStatusId === 3) {
    return { tier: 2, approverId: Number((snap as { n2UserId?: number }).n2UserId), snapshot: { ...snap } };
  }
  return { tier: null, approverId: null, snapshot: { ...snap } };
}

export async function processStaleApprovals(
  nowDate: Date = new Date(),
): Promise<{ reassigned: number; escalated: number; skipped: number }> {
  const stale = await ApprovalSubstituteModel.listStalePendingRequests(nowDate);
  const results = { reassigned: 0, escalated: 0, skipped: 0 };

  for (const row of stale) {
    const { requestId, requestStatusId, workflowPreSnapshot } = row;
    const { tier, approverId, snapshot } = resolveAssignedApprover(
      Number(requestStatusId),
      workflowPreSnapshot as { n1UserId?: number; n2UserId?: number } | null,
    );

    if (!tier || !Number.isFinite(approverId) || (approverId ?? 0) < 1) {
      results.skipped += 1;
      continue;
    }

    const sub = await ApprovalSubstituteModel.getActiveSubstitute(approverId!, nowDate);
    if (sub) {
      try {
        await ensureAuthorizerUser(sub.substituteId);
      } catch {
        results.skipped += 1;
        continue;
      }

      if (tier === 1) snapshot.n1UserId = Number(sub.substituteId);
      if (tier === 2) snapshot.n2UserId = Number(sub.substituteId);

      await ApprovalSubstituteModel.applyWorkflowAction(
        requestId,
        { statusId: Number(requestStatusId), workflowPreSnapshot: snapshot },
        Number(sub.substituteId),
        "REASIGNADO",
        `Reasignación automática por inactividad >48h. Aprobador original: ${approverId}, sustituto: ${sub.substituteId}.`,
      );
      await ApprovalSubstituteModel.createAlert(requestId, requestStatusId === 2 ? 2 : 3);
      results.reassigned += 1;
      continue;
    }

    if (Number(requestStatusId) === 2) {
      await ApprovalSubstituteModel.applyWorkflowAction(
        requestId,
        { statusId: 3 },
        approverId!,
        "ESCALADO",
        "Escalamiento automático por inactividad del aprobador >48h.",
      );
      await ApprovalSubstituteModel.createAlert(requestId, 3);
      results.escalated += 1;
      continue;
    }

    results.skipped += 1;
  }

  return results;
}

/** Compat con dispatcher legacy. */
export const upsertSubstitute = createSubstitute;
export const removeSubstitute = deleteSubstitute;

export default {
  listSubstitutes,
  createSubstitute,
  deleteSubstitute,
  processStaleApprovals,
};
