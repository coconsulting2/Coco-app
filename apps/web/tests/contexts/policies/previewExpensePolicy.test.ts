/**
 * Unit test del use-case `previewExpensePolicy` con stub in-memory del port
 * `ExpensePolicyPreviewQueries` — sin DB. Cubre:
 *  - solicitud inexistente → PolicyNotFoundError
 *  - dentro del tope (live lookup) → exceeded false, message "Dentro de la política."
 *  - excede el tope → exceeded true, cap más restrictivo, message de exceso
 *  - sin política aplicable → permitido (exceeded false, policyId null)
 *  - usa el snapshot congelado (RF-46) en vez del lookup en vivo
 */
import { describe, it, expect } from "vitest";
import {
  previewExpensePolicy,
  type PreviewExpensePolicyInput,
} from "~/contexts/policies/application/previewExpensePolicy";
import type {
  ActivePolicyWithCaps,
  ExpensePolicyPreviewQueries,
  RequestPreviewContext,
} from "~/contexts/policies/domain/ports/ExpensePolicyPreviewQueries";
import { PolicyNotFoundError } from "~/contexts/policies/domain/errors";

function makeContext(
  overrides: Partial<RequestPreviewContext> = {},
): RequestPreviewContext {
  return {
    requestId: 1,
    policyEvaluationSnapshot: null,
    organizationId: 100,
    routeRequests: [
      { route: { idOriginCountry: 1, idDestinationCountry: 1 } },
    ],
    ...overrides,
  };
}

function makePolicy(
  caps: ActivePolicyWithCaps["expenseCaps"],
): ActivePolicyWithCaps {
  return {
    policyId: 7,
    organizationId: 100,
    name: "Catch-all",
    categoryId: null,
    destinationScope: "any",
    costsCenter: null,
    dailyPerDiem: null,
    currency: "MXN",
    validFrom: "2026-01-01T00:00:00.000Z",
    validTo: null,
    active: true,
    expenseCaps: caps,
  };
}

function stubQueries(
  context: RequestPreviewContext | null,
  policies: ActivePolicyWithCaps[] = [],
): ExpensePolicyPreviewQueries {
  return {
    findRequestContext: async () => context,
    listActivePoliciesForOrg: async () => policies,
  };
}

const baseInput: PreviewExpensePolicyInput = {
  requestId: 1,
  receiptTypeId: 3,
  amount: 500,
  currency: "MXN",
};

describe("previewExpensePolicy", () => {
  it("lanza PolicyNotFoundError cuando la solicitud no existe", async () => {
    await expect(
      previewExpensePolicy(baseInput, { queries: stubQueries(null) }),
    ).rejects.toBeInstanceOf(PolicyNotFoundError);
  });

  it("dentro del tope → exceeded false", async () => {
    const policy = makePolicy([
      {
        capId: 11,
        policyId: 7,
        receiptTypeId: 3,
        capAmount: 1000,
        capUnit: "per_trip",
        currency: "MXN",
      },
    ]);
    const result = await previewExpensePolicy(
      { ...baseInput, amount: 500 },
      { queries: stubQueries(makeContext(), [policy]) },
    );
    expect(result.exceeded).toBe(false);
    expect(result.policyId).toBe(7);
    expect(result.capId).toBeNull();
    expect(result.message).toBe("Dentro de la política.");
  });

  it("excede el tope → exceeded true con el cap más restrictivo", async () => {
    const policy = makePolicy([
      {
        capId: 11,
        policyId: 7,
        receiptTypeId: 3,
        capAmount: 1000,
        capUnit: "per_trip",
        currency: "MXN",
      },
      {
        capId: 12,
        policyId: 7,
        receiptTypeId: 3,
        capAmount: 800,
        capUnit: "per_trip",
        currency: "MXN",
      },
    ]);
    const result = await previewExpensePolicy(
      { ...baseInput, amount: 1500 },
      { queries: stubQueries(makeContext(), [policy]) },
    );
    expect(result.exceeded).toBe(true);
    // cap 12 (800) genera más exceso (700) que cap 11 (500) → es el top breach.
    expect(result.capId).toBe(12);
    expect(result.capAmount).toBe(800);
    expect(result.excessTotal).toBe(700);
    expect(result.message).toContain("Excede política");
  });

  it("sin política aplicable → permitido", async () => {
    const result = await previewExpensePolicy(baseInput, {
      queries: stubQueries(makeContext(), []),
    });
    expect(result.exceeded).toBe(false);
    expect(result.policyId).toBeNull();
    expect(result.message).toBe(
      "No hay política aplicable; el monto se aceptará tal cual.",
    );
  });

  it("usa el snapshot congelado (RF-46) en vez del lookup en vivo", async () => {
    let liveLookupCalled = false;
    const queries: ExpensePolicyPreviewQueries = {
      findRequestContext: async () =>
        makeContext({
          policyEvaluationSnapshot: {
            policyId: 42,
            currency: "MXN",
            destinationScope: "nacional",
            caps: [
              {
                capId: 99,
                receiptTypeId: 3,
                capAmount: 300,
                capUnit: "per_trip",
                currency: "MXN",
              },
            ],
          },
        }),
      listActivePoliciesForOrg: async () => {
        liveLookupCalled = true;
        return [];
      },
    };
    const result = await previewExpensePolicy(
      { ...baseInput, amount: 500 },
      { queries },
    );
    expect(liveLookupCalled).toBe(false);
    expect(result.policyId).toBe(42);
    expect(result.exceeded).toBe(true);
    expect(result.capId).toBe(99);
    expect(result.excessTotal).toBe(200);
  });
});
