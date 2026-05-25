/**
 * Unit tests del use-case `rejectTravelRequest`. Cubre: rechazo válido en N1,
 * comentario obligatorio, rol no autorizado, status no autorizable.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("~/platform/logger/log/logger.js", () => ({
  Logger: () => ({ info() {}, warn() {}, error() {}, trace() {}, debug() {} }),
}));

import { rejectTravelRequest } from "~/contexts/approvals/application/rejectTravelRequest.js";
import type { RejectTravelRequestDeps } from "~/contexts/approvals/application/rejectTravelRequest.js";
import type {
  AuthorizerRepository,
  RequestAuthorizationContext,
} from "~/contexts/approvals/domain/ports/AuthorizerRepository.js";
import {
  NotAuthorizedToApproveError,
  RejectionReasonRequiredError,
  RequestNotInAuthorizationStatusError,
} from "~/contexts/approvals/domain/errors.js";

function makeRepo(
  ctx: RequestAuthorizationContext | null,
  roleName: string | null,
): AuthorizerRepository {
  return {
    getRequestAuthorizationContext: vi.fn(async () => ctx),
    getUserRoleName: vi.fn(async () => roleName),
    getUserMaxApprovalAmount: vi.fn(async () => null),
    applyWorkflowAction: vi.fn(async () => undefined),
    getAlertsForAuthorizer: vi.fn(async () => []),
  };
}

function makeDeps(repo: AuthorizerRepository): RejectTravelRequestDeps {
  return { authorizerRepo: repo, employeeHierarchy: { getApprovalChain: vi.fn(async () => []) } };
}

describe("rejectTravelRequest", () => {
  it("rechaza en N1: set status 10 con comentario", async () => {
    const repo = makeRepo(
      { requestStatusId: 2, workflowPreSnapshot: { levels: [1, 2] }, requestedFee: 500, userId: 7 },
      "N1",
    );
    const result = await rejectTravelRequest(
      { requestId: 1, actorUserId: 9, comentario: "  Documentación incompleta  ", useHierarchy: false },
      makeDeps(repo),
    );

    expect(result).toEqual({ newStatusId: 10, newStatusLabel: "Rechazado" });
    expect(repo.applyWorkflowAction).toHaveBeenCalledWith(
      1,
      { statusId: 10 },
      9,
      "RECHAZADO",
      "Documentación incompleta",
    );
  });

  it("exige comentario no vacío", async () => {
    const repo = makeRepo(
      { requestStatusId: 2, workflowPreSnapshot: null, requestedFee: 500, userId: 7 },
      "N1",
    );
    await expect(
      rejectTravelRequest({ requestId: 1, actorUserId: 9, comentario: "   " }, makeDeps(repo)),
    ).rejects.toBeInstanceOf(RejectionReasonRequiredError);
    expect(repo.applyWorkflowAction).not.toHaveBeenCalled();
  });

  it("rechaza si el rol no es N1/N2", async () => {
    const repo = makeRepo(
      { requestStatusId: 2, workflowPreSnapshot: null, requestedFee: 500, userId: 7 },
      "Solicitante",
    );
    await expect(
      rejectTravelRequest({ requestId: 1, actorUserId: 9, comentario: "motivo" }, makeDeps(repo)),
    ).rejects.toBeInstanceOf(NotAuthorizedToApproveError);
  });

  it("rechaza si el status no es autorizable", async () => {
    const repo = makeRepo(
      { requestStatusId: 6, workflowPreSnapshot: null, requestedFee: 500, userId: 7 },
      "N1",
    );
    await expect(
      rejectTravelRequest(
        { requestId: 1, actorUserId: 9, comentario: "motivo", useHierarchy: false },
        makeDeps(repo),
      ),
    ).rejects.toBeInstanceOf(RequestNotInAuthorizationStatusError);
  });
});
