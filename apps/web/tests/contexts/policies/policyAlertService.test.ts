/**
 * Unit tests del `policyAlertService.checkReceiptBeforeSubmit` con stub del
 * puerto PolicyAlertQueriesPort — sin DB. Cubre 404, dentro/fuera de tope,
 * sin política aplicable y uso del snapshot congelado (RF-46).
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("~/platform/logger/log/logger.js", () => ({
  Logger: () => ({ info() {}, warn() {}, error() {}, trace() {}, debug() {} }),
}));

vi.mock("~/contexts/policies/infrastructure/policyAlertQueries.js", () => ({
  prismaPolicyAlertQueries: {},
}));

import {
  checkReceiptBeforeSubmit,
  type PolicyAlertServiceDeps,
} from "~/contexts/policies/application/policyAlertService";
import type {
  PolicyAlertQueriesPort,
  RequestForPolicyPreview,
} from "~/contexts/policies/infrastructure/policyAlertQueries";
import type { TravelPolicyRow } from "~/contexts/policies/domain/types";

function makeRequest(over: Partial<RequestForPolicyPreview> = {}): RequestForPolicyPreview {
  return {
    requestId: 5,
    policyEvaluationSnapshot: null,
    user: { organizationId: 100 },
    routeRequests: [{ route: { idOriginCountry: 1, idDestinationCountry: 1 } }],
    ...over,
  };
}

function policyWithCap(amount: number): TravelPolicyRow {
  return {
    policyId: 7,
    organizationId: 100,
    name: "Cap",
    categoryId: null,
    destinationScope: "any",
    costsCenter: null,
    dailyPerDiem: null,
    currency: "MXN",
    validFrom: "2026-01-01",
    validTo: null,
    active: true,
    expenseCaps: [
      { capId: 1, policyId: 7, receiptTypeId: 2, capAmount: amount, capUnit: "per_event", currency: "MXN" },
    ],
  };
}

function deps(over: Partial<PolicyAlertQueriesPort> = {}): PolicyAlertServiceDeps {
  return {
    queries: {
      findRequestForPolicyPreview: vi.fn(async () => makeRequest()),
      listActivePoliciesForOrg: vi.fn(async () => []),
      ...over,
    },
  };
}

describe("checkReceiptBeforeSubmit", () => {
  it("throws 404 when request not found", async () => {
    const d = deps({ findRequestForPolicyPreview: vi.fn(async () => null) });
    await expect(
      checkReceiptBeforeSubmit({ requestId: 5, receiptTypeId: 2, amount: 100 }, d),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("returns within-policy when amount under cap", async () => {
    const d = deps({ listActivePoliciesForOrg: vi.fn(async () => [policyWithCap(500)]) });
    const result = await checkReceiptBeforeSubmit({ requestId: 5, receiptTypeId: 2, amount: 100 }, d);
    expect(result.exceeded).toBe(false);
    expect(result.message).toContain("Dentro de la política");
  });

  it("flags exceeded with restrictive cap when amount over cap", async () => {
    const d = deps({ listActivePoliciesForOrg: vi.fn(async () => [policyWithCap(100)]) });
    const result = await checkReceiptBeforeSubmit({ requestId: 5, receiptTypeId: 2, amount: 250 }, d);
    expect(result.exceeded).toBe(true);
    expect(result.capId).toBe(1);
    expect(result.excessTotal).toBeGreaterThan(0);
  });

  it("allows when no applicable policy", async () => {
    const d = deps({ listActivePoliciesForOrg: vi.fn(async () => []) });
    const result = await checkReceiptBeforeSubmit({ requestId: 5, receiptTypeId: 2, amount: 250 }, d);
    expect(result.exceeded).toBe(false);
    expect(result.policyId).toBeNull();
    expect(result.message).toContain("No hay política aplicable");
  });

  it("uses frozen snapshot (RF-46) instead of live lookup", async () => {
    const listActivePoliciesForOrg = vi.fn(async () => [policyWithCap(9999)]);
    const d = deps({
      findRequestForPolicyPreview: vi.fn(async () =>
        makeRequest({
          policyEvaluationSnapshot: {
            policyId: 7,
            currency: "MXN",
            caps: [{ capId: 1, receiptTypeId: 2, capAmount: 100, capUnit: "per_event", currency: "MXN" }],
          },
        }),
      ),
      listActivePoliciesForOrg,
    });
    const result = await checkReceiptBeforeSubmit({ requestId: 5, receiptTypeId: 2, amount: 250 }, d);
    expect(result.exceeded).toBe(true);
    // live lookup must NOT be consulted when snapshot present
    expect(listActivePoliciesForOrg).not.toHaveBeenCalled();
  });
});
