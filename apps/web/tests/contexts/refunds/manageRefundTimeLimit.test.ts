/**
 * Unit tests de los use-cases `getRefundTimeLimit` / `setRefundTimeLimit` con
 * stub in-memory del puerto `ReimbursementTimeRepository` — sin DB. Cubre:
 *  - get sin config previa → defaults (paridad con `getOrgTimeLimit`)
 *  - get con config existente → mapea la fila del repo
 *  - set happy path → valida rangos, delega en upsert con updatedById, devuelve fila
 *  - set con `active` omitido → default true
 *  - set fuera de rango / no entero / blockOnExpiry no boolean → InvalidRefundTimeLimitError
 */
import { describe, it, expect, vi } from "vitest";

import {
  getRefundTimeLimit,
  setRefundTimeLimit,
  InvalidRefundTimeLimitError,
  DEFAULT_DAYS_AFTER_TRIP,
  DEFAULT_GRACE_DAYS,
  DEFAULT_BLOCK_ON_EXPIRY,
  type ManageRefundTimeLimitDeps,
  type SetRefundTimeLimitInput,
} from "~/contexts/refunds/application/manageRefundTimeLimit";
import type {
  ReimbursementTimeRepository,
  ReimbursementTimeLimitRow,
} from "~/contexts/refunds/domain/ports/ReimbursementTimeRepository";

function makeRow(
  over: Partial<ReimbursementTimeLimitRow> = {},
): ReimbursementTimeLimitRow {
  return {
    daysAfterTrip: 20,
    graceDays: 5,
    blockOnExpiry: false,
    active: true,
    ...over,
  };
}

function makeRepo(
  over: Partial<ReimbursementTimeRepository> = {},
): ReimbursementTimeRepository {
  return {
    findByOrg: async () => makeRow(),
    upsert: async (_orgId, data) =>
      makeRow({
        daysAfterTrip: data.daysAfterTrip,
        graceDays: data.graceDays,
        blockOnExpiry: data.blockOnExpiry,
        active: data.active,
      }),
    ...over,
  };
}

function deps(repo: ReimbursementTimeRepository): ManageRefundTimeLimitDeps {
  return { timeRepo: repo };
}

const VALID_INPUT: SetRefundTimeLimitInput = {
  daysAfterTrip: 30,
  graceDays: 3,
  blockOnExpiry: true,
};

describe("getRefundTimeLimit", () => {
  it("devuelve defaults cuando no hay config previa", async () => {
    const findByOrg = vi.fn(async () => null);
    const out = await getRefundTimeLimit(101n, deps(makeRepo({ findByOrg })));
    expect(findByOrg).toHaveBeenCalledWith(101n);
    expect(out).toEqual({
      daysAfterTrip: DEFAULT_DAYS_AFTER_TRIP,
      graceDays: DEFAULT_GRACE_DAYS,
      blockOnExpiry: DEFAULT_BLOCK_ON_EXPIRY,
      active: true,
    });
  });

  it("mapea la fila existente del repo", async () => {
    const row = makeRow({ daysAfterTrip: 7, graceDays: 2, blockOnExpiry: true, active: false });
    const out = await getRefundTimeLimit(42, deps(makeRepo({ findByOrg: async () => row })));
    expect(out).toEqual({
      daysAfterTrip: 7,
      graceDays: 2,
      blockOnExpiry: true,
      active: false,
    });
  });
});

describe("setRefundTimeLimit", () => {
  it("valida, delega en upsert con updatedById y devuelve la fila", async () => {
    const upsert = vi.fn(async (_orgId: bigint | number, data) =>
      makeRow({
        daysAfterTrip: data.daysAfterTrip,
        graceDays: data.graceDays,
        blockOnExpiry: data.blockOnExpiry,
        active: data.active,
      }),
    );
    const out = await setRefundTimeLimit(101n, VALID_INPUT, 9, deps(makeRepo({ upsert })));
    expect(upsert).toHaveBeenCalledWith(101n, {
      daysAfterTrip: 30,
      graceDays: 3,
      blockOnExpiry: true,
      active: true,
      updatedById: 9,
    });
    expect(out).toEqual({
      daysAfterTrip: 30,
      graceDays: 3,
      blockOnExpiry: true,
      active: true,
    });
  });

  it("default active=true cuando se omite", async () => {
    const upsert = vi.fn(async () => makeRow());
    await setRefundTimeLimit(1, VALID_INPUT, null, deps(makeRepo({ upsert })));
    expect(upsert).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ active: true, updatedById: null }),
    );
  });

  it("respeta active=false explícito", async () => {
    const upsert = vi.fn(async () => makeRow({ active: false }));
    await setRefundTimeLimit(
      1,
      { ...VALID_INPUT, active: false },
      null,
      deps(makeRepo({ upsert })),
    );
    expect(upsert).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ active: false }),
    );
  });

  it("rechaza daysAfterTrip fuera de rango", async () => {
    const upsert = vi.fn();
    await expect(
      setRefundTimeLimit(1, { ...VALID_INPUT, daysAfterTrip: 400 }, null, deps(makeRepo({ upsert }))),
    ).rejects.toBeInstanceOf(InvalidRefundTimeLimitError);
    await expect(
      setRefundTimeLimit(1, { ...VALID_INPUT, daysAfterTrip: 0 }, null, deps(makeRepo({ upsert }))),
    ).rejects.toBeInstanceOf(InvalidRefundTimeLimitError);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rechaza graceDays fuera de rango", async () => {
    const upsert = vi.fn();
    await expect(
      setRefundTimeLimit(1, { ...VALID_INPUT, graceDays: 31 }, null, deps(makeRepo({ upsert }))),
    ).rejects.toBeInstanceOf(InvalidRefundTimeLimitError);
    await expect(
      setRefundTimeLimit(1, { ...VALID_INPUT, graceDays: -1 }, null, deps(makeRepo({ upsert }))),
    ).rejects.toBeInstanceOf(InvalidRefundTimeLimitError);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rechaza valores no enteros", async () => {
    const upsert = vi.fn();
    await expect(
      setRefundTimeLimit(1, { ...VALID_INPUT, daysAfterTrip: 14.5 }, null, deps(makeRepo({ upsert }))),
    ).rejects.toBeInstanceOf(InvalidRefundTimeLimitError);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rechaza blockOnExpiry no boolean", async () => {
    const upsert = vi.fn();
    await expect(
      setRefundTimeLimit(
        1,
        { ...VALID_INPUT, blockOnExpiry: "yes" as unknown as boolean },
        null,
        deps(makeRepo({ upsert })),
      ),
    ).rejects.toBeInstanceOf(InvalidRefundTimeLimitError);
    expect(upsert).not.toHaveBeenCalled();
  });
});
