/**
 * Unit tests del use-case `reassignApproval`. Cubre: reasignación N1 válida,
 * motivo obligatorio, target == actor, target sin rol N1/N2, status no
 * autorizable.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("~/platform/logger/log/logger.js", () => ({
  Logger: () => ({ info() {}, warn() {}, error() {}, trace() {}, debug() {} }),
}));

import { reassignApproval } from "~/contexts/approvals/application/reassignApproval.js";
import type { ReassignApprovalDeps } from "~/contexts/approvals/application/reassignApproval.js";
import type {
  AuthorizerRepository,
  RequestAuthorizationContext,
} from "~/contexts/approvals/domain/ports/AuthorizerRepository.js";
import {
  NotAuthorizedToApproveError,
  ReassignmentTargetInvalidError,
  RequestNotInAuthorizationStatusError,
} from "~/contexts/approvals/domain/errors.js";

function makeRepo(
  ctx: RequestAuthorizationContext | null,
  roleByUser: Record<number, string | null>,
): AuthorizerRepository {
  return {
    getRequestAuthorizationContext: vi.fn(async () => ctx),
    getUserRoleName: vi.fn(async (uid: number) => roleByUser[uid] ?? null),
    getUserMaxApprovalAmount: vi.fn(async () => null),
    applyWorkflowAction: vi.fn(async () => undefined),
    getAlertsForAuthorizer: vi.fn(async () => []),
  };
}

function deps(repo: AuthorizerRepository): ReassignApprovalDeps {
  return { authorizerRepo: repo };
}

describe("reassignApproval", () => {
  it("reasigna N1: actualiza n1UserId en el snapshot vía REASIGNADO", async () => {
    const repo = makeRepo(
      { requestStatusId: 2, workflowPreSnapshot: { levels: [1, 2], n1UserId: 9 }, requestedFee: 0, userId: 7 },
      { 9: "N1", 12: "N1" },
    );
    const result = await reassignApproval(
      { requestId: 1, actorUserId: 9, targetUserId: 12, motivo: "vacaciones" },
      deps(repo),
    );

    expect(result.message).toMatch(/reasignada correctamente/i);
    expect(repo.applyWorkflowAction).toHaveBeenCalledWith(
      1,
      { statusId: 2, workflowPreSnapshot: expect.objectContaining({ n1UserId: 12 }) },
      9,
      "REASIGNADO",
      expect.stringContaining("Reasignado a usuario 12"),
    );
  });

  it("exige motivo no vacío", async () => {
    const repo = makeRepo(null, {});
    await expect(
      reassignApproval({ requestId: 1, actorUserId: 9, targetUserId: 12, motivo: "  " }, deps(repo)),
    ).rejects.toBeInstanceOf(ReassignmentTargetInvalidError);
  });

  it("rechaza si el target es el mismo actor", async () => {
    const repo = makeRepo(null, {});
    await expect(
      reassignApproval({ requestId: 1, actorUserId: 9, targetUserId: 9, motivo: "x" }, deps(repo)),
    ).rejects.toBeInstanceOf(ReassignmentTargetInvalidError);
  });

  it("rechaza si el target no tiene rol N1/N2", async () => {
    const repo = makeRepo(
      { requestStatusId: 2, workflowPreSnapshot: { levels: [1, 2], n1UserId: 9 }, requestedFee: 0, userId: 7 },
      { 9: "N1", 12: "Solicitante" },
    );
    await expect(
      reassignApproval({ requestId: 1, actorUserId: 9, targetUserId: 12, motivo: "x" }, deps(repo)),
    ).rejects.toBeInstanceOf(ReassignmentTargetInvalidError);
  });

  it("rechaza si solo el aprobador asignado puede reasignar", async () => {
    const repo = makeRepo(
      { requestStatusId: 2, workflowPreSnapshot: { levels: [1, 2], n1UserId: 99 }, requestedFee: 0, userId: 7 },
      { 9: "N1", 12: "N1" },
    );
    await expect(
      reassignApproval({ requestId: 1, actorUserId: 9, targetUserId: 12, motivo: "x" }, deps(repo)),
    ).rejects.toBeInstanceOf(NotAuthorizedToApproveError);
  });

  it("rechaza si el status no es autorizable", async () => {
    const repo = makeRepo(
      { requestStatusId: 6, workflowPreSnapshot: { levels: [1, 2] }, requestedFee: 0, userId: 7 },
      { 9: "N1", 12: "N1" },
    );
    await expect(
      reassignApproval({ requestId: 1, actorUserId: 9, targetUserId: 12, motivo: "x" }, deps(repo)),
    ).rejects.toBeInstanceOf(RequestNotInAuthorizationStatusError);
  });
});
