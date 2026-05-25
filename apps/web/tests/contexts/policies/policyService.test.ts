/**
 * Unit tests del `policyService` con stub in-memory del puerto
 * PolicyQueriesPort — sin DB. Cubre validaciones (scope, fechas, capUnit),
 * filtros de listado, org-scoping y soft-delete.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("~/platform/logger/log/logger.js", () => ({
  Logger: () => ({ info() {}, warn() {}, error() {}, trace() {}, debug() {} }),
}));

// El adapter Prisma importa `@coco/db` transitivamente (no resuelve en vitest).
// Como todos los tests inyectan `deps` stub, basta cortar la cadena de import.
vi.mock("~/contexts/policies/infrastructure/policyQueries.js", () => ({
  prismaPolicyQueries: {},
}));

import {
  listPolicies,
  getPolicy,
  createPolicy,
  updatePolicy,
  deactivatePolicy,
  setExpenseCaps,
  type PolicyServiceDeps,
} from "~/contexts/policies/application/policyService";
import type { PolicyQueriesPort } from "~/contexts/policies/domain/ports/PolicyQueriesPort";
import type { TravelPolicyRow } from "~/contexts/policies/domain/types";

function makePolicy(overrides: Partial<TravelPolicyRow> = {}): TravelPolicyRow {
  return {
    policyId: 1,
    organizationId: 100,
    name: "Default",
    categoryId: null,
    destinationScope: "any",
    costsCenter: null,
    dailyPerDiem: null,
    currency: "MXN",
    validFrom: "2026-01-01",
    validTo: null,
    active: true,
    expenseCaps: [],
    ...overrides,
  };
}

function stubQueries(over: Partial<PolicyQueriesPort> = {}): PolicyQueriesPort {
  return {
    listPoliciesWith: vi.fn(async () => []),
    findPolicyById: vi.fn(async () => null),
    updatePolicyRow: vi.fn(async (id) => makePolicy({ policyId: id })),
    createPolicyWithCapsTx: vi.fn(async (data) => makePolicy({ name: data.name })),
    updatePolicyWithCapsTx: vi.fn(async (id) => makePolicy({ policyId: id })),
    setExpenseCapsInTx: vi.fn(async () => {}),
    replaceExpenseCapsTx: vi.fn(async (id) => makePolicy({ policyId: id })),
    findPoliciesForRequestSnapshot: vi.fn(async () => ({ orgId: null, policies: [] })),
    updateRequestSnapshot: vi.fn(async () => ({})),
    ...over,
  };
}

function deps(over: Partial<PolicyQueriesPort> = {}): PolicyServiceDeps {
  return { queries: stubQueries(over) };
}

describe("policyService.listPolicies", () => {
  it("filters active by default and applies categoryId + asOfDate", async () => {
    let captured: Record<string, unknown> = {};
    const listPoliciesWith = vi.fn(async (where: Record<string, unknown>) => {
      captured = where;
      return [makePolicy()];
    });
    await listPolicies(100n, { categoryId: 5, asOfDate: "2026-06-01" }, deps({ listPoliciesWith }));
    const where = captured;
    expect(where.active).toBe(true);
    expect(where.categoryId).toBe(5);
    expect(where.validFrom).toBeDefined();
    expect(where.OR).toBeDefined();
  });

  it("omits active filter when activeOnly is false", async () => {
    let captured: Record<string, unknown> = {};
    const listPoliciesWith = vi.fn(async (where: Record<string, unknown>) => {
      captured = where;
      return [];
    });
    await listPolicies(100n, { activeOnly: false }, deps({ listPoliciesWith }));
    expect(captured.active).toBeUndefined();
  });
});

describe("policyService.getPolicy", () => {
  it("returns null when org mismatch", async () => {
    const findPolicyById = vi.fn(async () => makePolicy({ organizationId: 999 }));
    const result = await getPolicy(1, 100, deps({ findPolicyById }));
    expect(result).toBeNull();
  });

  it("returns row when org matches", async () => {
    const findPolicyById = vi.fn(async () => makePolicy({ organizationId: 100 }));
    const result = await getPolicy(1, 100, deps({ findPolicyById }));
    expect(result).not.toBeNull();
  });
});

describe("policyService.createPolicy", () => {
  it("rejects invalid destinationScope", async () => {
    await expect(
      createPolicy(100, { name: "X", destinationScope: "lunar" as never, validFrom: "2026-01-01" }, deps()),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects missing validFrom", async () => {
    await expect(
      createPolicy(100, { name: "X" }, deps()),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects invalid capUnit", async () => {
    await expect(
      createPolicy(
        100,
        { name: "X", validFrom: "2026-01-01", caps: [{ receiptTypeId: 1, capAmount: 10, capUnit: "per_galaxy" as never }] },
        deps(),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects validFrom > validTo", async () => {
    await expect(
      createPolicy(100, { name: "X", validFrom: "2026-12-01", validTo: "2026-01-01" }, deps()),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("creates with normalized data when valid", async () => {
    const createPolicyWithCapsTx = vi.fn(async (data) => makePolicy({ name: data.name }));
    await createPolicy(
      100,
      { name: "  Trip  ", validFrom: "2026-01-01" },
      deps({ createPolicyWithCapsTx }),
    );
    const data = createPolicyWithCapsTx.mock.calls[0]![0];
    expect(data.name).toBe("Trip");
    expect(data.destinationScope).toBe("any");
    expect(data.active).toBe(true);
  });
});

describe("policyService.updatePolicy / deactivatePolicy / setExpenseCaps", () => {
  it("throws 404 when policy not found", async () => {
    await expect(updatePolicy(1, 100, { name: "Y" }, deps())).rejects.toMatchObject({ status: 404 });
    await expect(deactivatePolicy(1, 100, deps())).rejects.toMatchObject({ status: 404 });
    await expect(setExpenseCaps(1, 100, [], deps())).rejects.toMatchObject({ status: 404 });
  });

  it("deactivate sets active=false", async () => {
    const findPolicyById = vi.fn(async () => makePolicy({ organizationId: 100 }));
    const updatePolicyRow = vi.fn(async (id) => makePolicy({ policyId: id, active: false }));
    await deactivatePolicy(1, 100, deps({ findPolicyById, updatePolicyRow }));
    expect(updatePolicyRow).toHaveBeenCalledWith(1, { active: false });
  });
});
