/**
 * Unit tests del `policyExceptionService` con stubs del puerto
 * PolicyExceptionQueriesPort y de `notify` — sin DB. Cubre validación de
 * justificación, autorización por snapshot, idempotencia de decisión y
 * filtrado por aprobador.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("~/platform/logger/log/logger.js", () => ({
  Logger: () => ({ info() {}, warn() {}, error() {}, trace() {}, debug() {} }),
}));

vi.mock("~/contexts/policies/infrastructure/policyExceptionQueries.js", () => ({
  prismaPolicyExceptionQueries: {},
}));

// El servicio importa `createNotification` (default dep `notify`) que arrastra
// Prisma/web-push transitivamente. Todos los tests inyectan `notify` stub.
vi.mock("~/contexts/notifications", () => ({
  createNotification: async () => null,
}));

import {
  createException,
  decideException,
  listPendingForApprover,
  listExceptions,
  type PolicyExceptionServiceDeps,
} from "~/contexts/policies/application/policyExceptionService";
import type {
  DecideExceptionArgs,
  ExceptionWithRequest,
  PendingExceptionWithJoins,
  PolicyExceptionQueriesPort,
  RequestForException,
} from "~/contexts/policies/domain/ports/PolicyExceptionQueriesPort";
import type { PolicyExceptionRow } from "~/contexts/policies/domain/types";

function makeException(over: Partial<PolicyExceptionRow> = {}): PolicyExceptionRow {
  return {
    exceptionId: 10,
    organizationId: 100,
    requestId: 5,
    receiptId: null,
    policyId: null,
    capId: null,
    amountClaimed: 100,
    amountAllowed: null,
    excessAmount: 20,
    justification: "x".repeat(15),
    status: "PENDING",
    requestedById: 7,
    ...over,
  };
}

function stub(over: Partial<PolicyExceptionQueriesPort> = {}): PolicyExceptionQueriesPort {
  return {
    findRequestForException: vi.fn(
      async (): Promise<RequestForException> => ({
        requestId: 5,
        workflowPreSnapshot: { n1UserId: 11, n2UserId: 12 },
        userId: 7,
        organizationId: 100,
      }),
    ),
    createPolicyException: vi.fn(async () => makeException()),
    findExceptionWithRequest: vi.fn(
      async (): Promise<ExceptionWithRequest> => ({
        ...makeException(),
        request: { workflowPreSnapshot: { n1UserId: 11 }, userId: 7, organizationId: 100 },
      }),
    ),
    decideExceptionTx: vi.fn(async () => makeException({ status: "APPROVED" })),
    findPendingExceptionsForRequest: vi.fn(async () => [makeException()]),
    findAllPendingExceptions: vi.fn(async () => [] as PendingExceptionWithJoins[]),
    ...over,
  };
}

function deps(over: Partial<PolicyExceptionQueriesPort> = {}): PolicyExceptionServiceDeps {
  return { queries: stub(over), notify: vi.fn(async () => null) };
}

describe("createException", () => {
  it("rejects justification shorter than 10 chars", async () => {
    await expect(
      createException(
        { requestId: 5, amountClaimed: 1, excessAmount: 1, justification: "short", requestedById: 7 },
        deps(),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("throws 404 when request not found", async () => {
    const d = deps({ findRequestForException: vi.fn(async () => null) });
    await expect(
      createException(
        { requestId: 5, amountClaimed: 1, excessAmount: 1, justification: "y".repeat(12), requestedById: 7 },
        d,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("creates PENDING exception and notifies approvers", async () => {
    const notify = vi.fn(async () => null);
    const createPolicyException = vi.fn(async () => makeException());
    await createException(
      { requestId: 5, amountClaimed: 100, excessAmount: 20, justification: "z".repeat(12), requestedById: 7 },
      { queries: stub({ createPolicyException }), notify },
    );
    expect(createPolicyException).toHaveBeenCalledOnce();
    // n1=11, n2=12 → 2 notifications
    expect(notify).toHaveBeenCalledTimes(2);
  });
});

describe("decideException", () => {
  it("rejects invalid decision", async () => {
    await expect(
      decideException(10, "MAYBE" as never, 11, null, deps()),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("throws 404 when exception not found", async () => {
    const d = deps({ findExceptionWithRequest: vi.fn(async () => null) });
    await expect(decideException(10, "APPROVED", 11, null, d)).rejects.toMatchObject({ status: 404 });
  });

  it("rejects deciding an already-decided exception", async () => {
    const d = deps({
      findExceptionWithRequest: vi.fn(async () => ({
        ...makeException({ status: "APPROVED" }),
        request: { workflowPreSnapshot: { n1UserId: 11 }, userId: 7, organizationId: 100 },
      })),
    });
    await expect(decideException(10, "APPROVED", 11, null, d)).rejects.toMatchObject({ status: 400 });
  });

  it("rejects decider not in designated approvers", async () => {
    await expect(decideException(10, "APPROVED", 999, null, deps())).rejects.toMatchObject({ status: 403 });
  });

  it("approves when decider is a designated approver and marks refund", async () => {
    let captured: DecideExceptionArgs | null = null;
    const decideExceptionTx = vi.fn(async (args: DecideExceptionArgs) => {
      captured = args;
      return makeException({ status: "APPROVED" });
    });
    await decideException(10, "APPROVED", 11, "ok", deps({ decideExceptionTx }));
    expect(captured!.refundFlag).toBe(true);
    expect(captured!.accion).toBe("APROBADO");
  });
});

describe("listPendingForApprover / listExceptions", () => {
  it("filters pending exceptions by approver ids in snapshot", async () => {
    const rows: PendingExceptionWithJoins[] = [
      { ...makeException({ exceptionId: 1 }), request: { requestId: 5, userId: 7, workflowPreSnapshot: { n1UserId: 11 } } },
      { ...makeException({ exceptionId: 2 }), request: { requestId: 6, userId: 8, workflowPreSnapshot: { n1UserId: 99 } } },
      { ...makeException({ exceptionId: 3 }), request: { requestId: 7, userId: 9, workflowPreSnapshot: null } },
    ];
    const d = deps({ findAllPendingExceptions: vi.fn(async () => rows) });
    const result = await listPendingForApprover(11, d);
    // approver 11 sees #1 (matches) and #3 (no approvers → visible)
    expect(result.map((r) => r.exceptionId).sort()).toEqual([1, 3]);
  });

  it("listExceptions returns all pending unfiltered", async () => {
    const rows: PendingExceptionWithJoins[] = [
      { ...makeException({ exceptionId: 1 }), request: { requestId: 5, userId: 7, workflowPreSnapshot: { n1UserId: 99 } } },
    ];
    const d = deps({ findAllPendingExceptions: vi.fn(async () => rows) });
    const result = await listExceptions(d);
    expect(result).toHaveLength(1);
  });
});
