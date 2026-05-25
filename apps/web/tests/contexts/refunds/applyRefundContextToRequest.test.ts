/**
 * Unit tests del helper `applyRefundContextToRequest`. Mockea
 * `policies/policyService.snapshotPolicyForRequest` y pasa un `tx` falso con
 * los métodos Prisma que el use-case consume. Cubre: cálculo del tripEndDate
 * (máximo endingDate), inferencia de scope nacional vs internacional, y el
 * caso sin rutas con fecha (no actualiza tripEndDate).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("~/platform/logger/log/logger.js", () => ({
  Logger: () => ({ info() {}, warn() {}, error() {}, trace() {}, debug() {} }),
}));

const snapshotPolicyForRequest = vi.fn();
vi.mock("~/contexts/policies/application/policyService.js", () => ({
  snapshotPolicyForRequest: (...a: unknown[]) => snapshotPolicyForRequest(...a),
}));

import { applyRefundContextToRequest } from "~/contexts/refunds/application/applyRefundContext.js";

type RouteRow = { idDestinationCountry?: number | null; endingDate?: Date | string | null };

function makeTx(routes: RouteRow[]) {
  const update = vi.fn(async () => undefined);
  const findMany = vi.fn(async () => routes.map((route) => ({ route })));
  return {
    tx: { routeRequest: { findMany }, request: { update } },
    update,
    findMany,
  };
}

beforeEach(() => {
  snapshotPolicyForRequest.mockReset();
  snapshotPolicyForRequest.mockResolvedValue({ policyId: 55 });
});

describe("applyRefundContextToRequest", () => {
  it("calcula tripEndDate (máximo endingDate) e infiere scope nacional", async () => {
    const { tx, update } = makeTx([
      { idDestinationCountry: 1, endingDate: new Date("2026-04-03T00:00:00.000Z") },
      { idDestinationCountry: 1, endingDate: new Date("2026-04-06T00:00:00.000Z") },
    ]);

    const result = await applyRefundContextToRequest(tx, 1, { categoryId: 9, costsCenter: "CC1" });

    expect(result.tripEndDate).toEqual(new Date("2026-04-06T00:00:00.000Z"));
    expect(result.policyId).toBe(55);
    expect(update).toHaveBeenCalledWith({
      where: { requestId: 1 },
      data: { tripEndDate: new Date("2026-04-06T00:00:00.000Z") },
    });
    expect(snapshotPolicyForRequest).toHaveBeenCalledWith(tx, 1, {
      categoryId: 9,
      destinationScope: "nacional",
      costsCenter: "CC1",
    });
  });

  it("infiere scope internacional cuando hay un país destino distinto al local", async () => {
    const { tx } = makeTx([
      { idDestinationCountry: 1, endingDate: new Date("2026-04-03T00:00:00.000Z") },
      { idDestinationCountry: 7, endingDate: new Date("2026-04-04T00:00:00.000Z") },
    ]);

    await applyRefundContextToRequest(tx, 2);

    expect(snapshotPolicyForRequest).toHaveBeenCalledWith(
      tx,
      2,
      expect.objectContaining({ destinationScope: "internacional" }),
    );
  });

  it("no actualiza tripEndDate cuando ninguna ruta tiene fecha de fin", async () => {
    const { tx, update } = makeTx([{ idDestinationCountry: 1, endingDate: null }]);

    const result = await applyRefundContextToRequest(tx, 3);

    expect(result.tripEndDate).toBeNull();
    expect(update).not.toHaveBeenCalled();
    expect(result.policyId).toBe(55);
  });
});
