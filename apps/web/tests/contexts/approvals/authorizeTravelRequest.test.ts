/**
 * Unit tests del use-case `authorizeTravelRequest` con stubs in-memory de los
 * ports (AuthorizerRepository, WorkflowRulesPort, PolicyExceptionPort,
 * AnticipoPolizaPort, EmployeeHierarchyPort). Cubre: aprobación N1 (avance a
 * status 4), escalado N1 por monto, aprobación N2, bloqueo por excepciones de
 * política pendientes, autorización inválida, y status no autorizable.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("~/platform/logger/log/logger.js", () => ({
  Logger: () => ({ info() {}, warn() {}, error() {}, trace() {}, debug() {} }),
}));

import { authorizeTravelRequest } from "~/contexts/approvals/application/authorizeTravelRequest.js";
import type { AuthorizeTravelRequestDeps } from "~/contexts/approvals/application/authorizeTravelRequest.js";
import type {
  AuthorizerRepository,
  RequestAuthorizationContext,
} from "~/contexts/approvals/domain/ports/AuthorizerRepository.js";
import {
  NotAuthorizedToApproveError,
  AmountExceedsTopLimitError,
  PendingPolicyExceptionsError,
  RequestNotInAuthorizationStatusError,
} from "~/contexts/approvals/domain/errors.js";

type RepoOverrides = {
  ctx?: RequestAuthorizationContext | null;
  roleName?: string | null;
  maxAmount?: number | null;
};

function makeAuthorizerRepo(o: RepoOverrides = {}): AuthorizerRepository {
  return {
    getRequestAuthorizationContext: vi.fn(async () =>
      o.ctx === undefined
        ? { requestStatusId: 2, workflowPreSnapshot: null, requestedFee: 1000, userId: 7 }
        : o.ctx,
    ),
    getUserRoleName: vi.fn(async () => (o.roleName === undefined ? "N1" : o.roleName)),
    getUserMaxApprovalAmount: vi.fn(async () => o.maxAmount ?? null),
    applyWorkflowAction: vi.fn(async () => undefined),
    getAlertsForAuthorizer: vi.fn(async () => []),
  };
}

function makeDeps(repo: AuthorizerRepository): AuthorizeTravelRequestDeps {
  return {
    authorizerRepo: repo,
    workflowRules: {
      statusAfterN1Approval: vi.fn((levels: number[]) => (levels.includes(2) ? 3 : 4)),
      statusAfterN2Approval: vi.fn(() => 4),
    },
    policyExceptions: {
      listPendingForRequest: vi.fn(async () => []),
      decideException: vi.fn(async () => undefined),
    },
    anticipoPoliza: { onTravelRequestFullyApproved: vi.fn(async () => undefined) },
    employeeHierarchy: { getApprovalChain: vi.fn(async () => []) },
  };
}

describe("authorizeTravelRequest", () => {
  it("aprueba en N1 y avanza a status final cuando no hay segundo nivel", async () => {
    const repo = makeAuthorizerRepo({
      ctx: { requestStatusId: 2, workflowPreSnapshot: { levels: [1] }, requestedFee: 500, userId: 7 },
      roleName: "N1",
    });
    const deps = makeDeps(repo);

    const result = await authorizeTravelRequest(
      { requestId: 1, actorUserId: 9, useHierarchy: false },
      deps,
    );

    expect(result.outcome).toBe("APROBADO");
    expect(result.newStatusId).toBe(4);
    expect(repo.applyWorkflowAction).toHaveBeenCalledWith(1, { statusId: 4 }, 9, "APROBADO", null);
    expect(deps.anticipoPoliza.onTravelRequestFullyApproved).toHaveBeenCalledWith(1);
  });

  it("escala a N2 (status 3) cuando el monto supera el tope del aprobador N1", async () => {
    const repo = makeAuthorizerRepo({
      ctx: { requestStatusId: 2, workflowPreSnapshot: { levels: [1, 2] }, requestedFee: 9000, userId: 7 },
      roleName: "N1",
      maxAmount: 5000,
    });
    const deps = makeDeps(repo);

    const result = await authorizeTravelRequest(
      { requestId: 2, actorUserId: 9, useHierarchy: false },
      deps,
    );

    expect(result.outcome).toBe("ESCALADO");
    expect(result.newStatusId).toBe(3);
    expect(repo.applyWorkflowAction).toHaveBeenCalledWith(2, { statusId: 3 }, 9, "ESCALADO", null);
  });

  it("aprueba en N2 y avanza a status 4 (aprobación final)", async () => {
    const repo = makeAuthorizerRepo({
      ctx: { requestStatusId: 3, workflowPreSnapshot: { levels: [1, 2] }, requestedFee: 500, userId: 7 },
      roleName: "N2",
    });
    const deps = makeDeps(repo);

    const result = await authorizeTravelRequest(
      { requestId: 3, actorUserId: 9, useHierarchy: false },
      deps,
    );

    expect(result.outcome).toBe("APROBADO");
    expect(result.newStatusId).toBe(4);
    expect(deps.anticipoPoliza.onTravelRequestFullyApproved).toHaveBeenCalledWith(3);
  });

  it("lanza AmountExceedsTopLimitError en N2 cuando el monto supera el tope", async () => {
    const repo = makeAuthorizerRepo({
      ctx: { requestStatusId: 3, workflowPreSnapshot: { levels: [1, 2] }, requestedFee: 9000, userId: 7 },
      roleName: "N2",
      maxAmount: 5000,
    });
    const deps = makeDeps(repo);

    await expect(
      authorizeTravelRequest({ requestId: 4, actorUserId: 9, useHierarchy: false }, deps),
    ).rejects.toBeInstanceOf(AmountExceedsTopLimitError);
  });

  it("bloquea cuando hay excepciones de política pendientes", async () => {
    const repo = makeAuthorizerRepo({
      ctx: { requestStatusId: 2, workflowPreSnapshot: { levels: [1] }, requestedFee: 500, userId: 7 },
      roleName: "N1",
    });
    const deps = makeDeps(repo);
    deps.policyExceptions.listPendingForRequest = vi.fn(async () => [{ id: 1, status: "PENDING" }]);

    await expect(
      authorizeTravelRequest({ requestId: 5, actorUserId: 9, useHierarchy: false }, deps),
    ).rejects.toBeInstanceOf(PendingPolicyExceptionsError);
    expect(repo.applyWorkflowAction).not.toHaveBeenCalled();
  });

  it("lanza NotAuthorizedToApproveError cuando el rol no corresponde al tier", async () => {
    const repo = makeAuthorizerRepo({
      ctx: { requestStatusId: 2, workflowPreSnapshot: { levels: [1] }, requestedFee: 500, userId: 7 },
      roleName: "N2",
    });
    const deps = makeDeps(repo);

    await expect(
      authorizeTravelRequest({ requestId: 6, actorUserId: 9, useHierarchy: false }, deps),
    ).rejects.toBeInstanceOf(NotAuthorizedToApproveError);
  });

  it("lanza RequestNotInAuthorizationStatusError si el status no es 2 ni 3", async () => {
    const repo = makeAuthorizerRepo({
      ctx: { requestStatusId: 5, workflowPreSnapshot: null, requestedFee: 500, userId: 7 },
      roleName: "N1",
    });
    const deps = makeDeps(repo);

    await expect(
      authorizeTravelRequest({ requestId: 7, actorUserId: 9, useHierarchy: false }, deps),
    ).rejects.toBeInstanceOf(RequestNotInAuthorizationStatusError);
  });
});
