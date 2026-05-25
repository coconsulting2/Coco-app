/**
 * Unit tests del use-case `confirmImposedFee` con stub del port
 * `CxpAttendRepository`. Cubre: avance a status 5 cuando requiere agencia,
 * avance a status 7 cuando no, request inexistente, e imposedFee inválido.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("~/platform/logger/log/logger.js", () => ({
  Logger: () => ({ info() {}, warn() {}, error() {}, trace() {}, debug() {} }),
}));

import {
  confirmImposedFee,
  CxpRequestNotFoundError,
} from "~/contexts/accounts-payable/application/confirmImposedFee.js";
import type { CxpAttendRepository } from "~/contexts/accounts-payable/domain/ports/CxpAttendRepository.js";

function makeRepo(
  needs: { needsPlane: boolean; needsHotel: boolean } | null,
): CxpAttendRepository {
  return {
    getAgencyNeeds: vi.fn(async () => needs),
    assignImposedFee: vi.fn(async () => undefined),
  };
}

describe("confirmImposedFee", () => {
  it("avanza a status 5 cuando la Request requiere agencia (vuelo)", async () => {
    const repo = makeRepo({ needsPlane: true, needsHotel: false });

    const result = await confirmImposedFee({ requestId: 1, imposedFee: 3000 }, { attendRepo: repo });

    expect(result).toEqual({ newStatusId: 5, needsAgency: true });
    expect(repo.assignImposedFee).toHaveBeenCalledWith(1, 3000, 5);
  });

  it("avanza a status 7 cuando no requiere agencia", async () => {
    const repo = makeRepo({ needsPlane: false, needsHotel: false });

    const result = await confirmImposedFee({ requestId: 2, imposedFee: 1500 }, { attendRepo: repo });

    expect(result).toEqual({ newStatusId: 7, needsAgency: false });
    expect(repo.assignImposedFee).toHaveBeenCalledWith(2, 1500, 7);
  });

  it("lanza CxpRequestNotFoundError cuando la Request no existe", async () => {
    const repo = makeRepo(null);

    await expect(
      confirmImposedFee({ requestId: 99, imposedFee: 100 }, { attendRepo: repo }),
    ).rejects.toBeInstanceOf(CxpRequestNotFoundError);
    expect(repo.assignImposedFee).not.toHaveBeenCalled();
  });

  it("rechaza un imposedFee negativo o no finito", async () => {
    const repo = makeRepo({ needsPlane: false, needsHotel: false });

    await expect(
      confirmImposedFee({ requestId: 1, imposedFee: -5 }, { attendRepo: repo }),
    ).rejects.toThrow(/non-negative finite/);
    await expect(
      confirmImposedFee({ requestId: 1, imposedFee: Number.NaN }, { attendRepo: repo }),
    ).rejects.toThrow(/non-negative finite/);
    expect(repo.getAgencyNeeds).not.toHaveBeenCalled();
  });
});
