/**
 * Unit tests del `viaticasPolicyService` con stubs de los puertos
 * ViaticosPolicyRepositoryPort y ViaticosUserQueriesPort — sin DB. Cubre el
 * gate de tope (hotel vs comidas) y lectura/escritura org-scoped.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("~/platform/logger/log/logger.js", () => ({
  Logger: () => ({ info() {}, warn() {}, error() {}, trace() {}, debug() {} }),
}));

vi.mock("~/contexts/policies/infrastructure/viaticasPolicyModel.js", () => ({
  default: {},
}));
vi.mock("~/contexts/policies/infrastructure/viaticasPolicyQueries.js", () => ({
  prismaViaticosUserQueries: {},
}));

import {
  checkFeeVsViaticosPolicy,
  getViaticosPolicy,
  setViaticosPolicy,
  type ViaticasPolicyServiceDeps,
} from "~/contexts/policies/application/viaticasPolicyService";
import type { ViaticosPolicyRow } from "~/contexts/policies/domain/types";

function makePolicy(over: Partial<ViaticosPolicyRow> = {}): ViaticosPolicyRow {
  return {
    id: 1,
    org_id: "100",
    max_hotel: 2000,
    max_meal: 500,
    currency: "MXN",
    active: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...over,
  };
}

function deps(over: {
  orgId?: bigint | null;
  policy?: ViaticosPolicyRow | null;
} = {}): ViaticasPolicyServiceDeps {
  return {
    repository: {
      getByOrg: vi.fn(async () => (over.policy === undefined ? makePolicy() : over.policy)),
      upsert: vi.fn(async (_org, payload) =>
        makePolicy({ max_hotel: payload.maxHotel, max_meal: payload.maxMeal }),
      ),
    },
    userQueries: {
      getUserOrganizationId: vi.fn(async () => (over.orgId === undefined ? 100n : over.orgId)),
    },
  };
}

describe("checkFeeVsViaticosPolicy", () => {
  it("no-ops when user has no organization", async () => {
    await expect(checkFeeVsViaticosPolicy(7, 99999, true, deps({ orgId: null }))).resolves.toBeUndefined();
  });

  it("no-ops when policy missing or inactive", async () => {
    await expect(checkFeeVsViaticosPolicy(7, 99999, true, deps({ policy: null }))).resolves.toBeUndefined();
    await expect(
      checkFeeVsViaticosPolicy(7, 99999, true, deps({ policy: makePolicy({ active: false }) })),
    ).resolves.toBeUndefined();
  });

  it("throws 422 when hotel fee exceeds max_hotel", async () => {
    await expect(checkFeeVsViaticosPolicy(7, 3000, true, deps())).rejects.toMatchObject({ status: 422 });
  });

  it("throws 422 when meal fee exceeds max_meal", async () => {
    await expect(checkFeeVsViaticosPolicy(7, 600, false, deps())).rejects.toMatchObject({ status: 422 });
  });

  it("passes when within applicable cap", async () => {
    await expect(checkFeeVsViaticosPolicy(7, 1500, true, deps())).resolves.toBeUndefined();
    await expect(checkFeeVsViaticosPolicy(7, 400, false, deps())).resolves.toBeUndefined();
  });
});

describe("getViaticosPolicy / setViaticosPolicy", () => {
  it("reads org policy", async () => {
    const result = await getViaticosPolicy(100, deps());
    expect(result?.org_id).toBe("100");
  });

  it("upserts org policy", async () => {
    const result = await setViaticosPolicy(100, { maxHotel: 999, maxMeal: 99 }, deps());
    expect(result.max_hotel).toBe(999);
    expect(result.max_meal).toBe(99);
  });
});
