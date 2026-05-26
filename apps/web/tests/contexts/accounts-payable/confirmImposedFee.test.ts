/**
 * Unit tests del use-case canónico `confirmImposedFee` con stub del port
 * `CxpAttendRepository`. Cubre la paridad con el legacy
 * `accountsPayableController.attendTravelRequest`:
 *   - sin agencia → status 6 (Comprobación de gastos)
 *   - con vuelo/hotel → status 5 (Atención Agencia)
 *   - status ≠ 4 → rechaza (no atendible)
 *   - request inexistente → 404
 *   - imposedFee inválido → rechaza
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("~/platform/logger/log/logger.js", () => ({
  Logger: () => ({ info() {}, warn() {}, error() {}, trace() {}, debug() {} }),
}));

import {
  confirmImposedFee,
  CxpRequestNotFoundError,
  CxpRequestNotAttendableError,
} from "~/contexts/accounts-payable/application/confirmImposedFee.js";
import type {
  CxpAttendRepository,
  CxpAttendState,
} from "~/contexts/accounts-payable/domain/ports/CxpAttendRepository.js";

function makeRepo(state: CxpAttendState | null): CxpAttendRepository {
  return {
    getAttendState: vi.fn(async () => state),
    assignImposedFee: vi.fn(async () => undefined),
  };
}

describe("confirmImposedFee", () => {
  it("(a) sin agencia → avanza a status 6 (Comprobación de gastos)", async () => {
    const repo = makeRepo({ requestStatusId: 4, needsPlane: false, needsHotel: false });

    const result = await confirmImposedFee(
      { requestId: 2, imposedFee: 1500 },
      { attendRepo: repo },
    );

    expect(result).toEqual({ newStatusId: 6, needsAgency: false });
    expect(repo.assignImposedFee).toHaveBeenCalledWith(2, 1500, 6);
  });

  it("(b) con vuelo → avanza a status 5 (Atención Agencia)", async () => {
    const repo = makeRepo({ requestStatusId: 4, needsPlane: true, needsHotel: false });

    const result = await confirmImposedFee(
      { requestId: 1, imposedFee: 3000 },
      { attendRepo: repo },
    );

    expect(result).toEqual({ newStatusId: 5, needsAgency: true });
    expect(repo.assignImposedFee).toHaveBeenCalledWith(1, 3000, 5);
  });

  it("(b') con hotel → avanza a status 5 (Atención Agencia)", async () => {
    const repo = makeRepo({ requestStatusId: 4, needsPlane: false, needsHotel: true });

    const result = await confirmImposedFee(
      { requestId: 3, imposedFee: 2000 },
      { attendRepo: repo },
    );

    expect(result).toEqual({ newStatusId: 5, needsAgency: true });
    expect(repo.assignImposedFee).toHaveBeenCalledWith(3, 2000, 5);
  });

  it("(c) status ≠ 4 → rechaza con CxpRequestNotAttendableError y no muta", async () => {
    const repo = makeRepo({ requestStatusId: 6, needsPlane: true, needsHotel: false });

    await expect(
      confirmImposedFee({ requestId: 4, imposedFee: 100 }, { attendRepo: repo }),
    ).rejects.toBeInstanceOf(CxpRequestNotAttendableError);
    expect(repo.assignImposedFee).not.toHaveBeenCalled();
  });

  it("lanza CxpRequestNotFoundError cuando la Request no existe", async () => {
    const repo = makeRepo(null);

    await expect(
      confirmImposedFee({ requestId: 99, imposedFee: 100 }, { attendRepo: repo }),
    ).rejects.toBeInstanceOf(CxpRequestNotFoundError);
    expect(repo.assignImposedFee).not.toHaveBeenCalled();
  });

  it("rechaza un imposedFee negativo o no finito", async () => {
    const repo = makeRepo({ requestStatusId: 4, needsPlane: false, needsHotel: false });

    await expect(
      confirmImposedFee({ requestId: 1, imposedFee: -5 }, { attendRepo: repo }),
    ).rejects.toThrow(/non-negative finite/);
    await expect(
      confirmImposedFee({ requestId: 1, imposedFee: Number.NaN }, { attendRepo: repo }),
    ).rejects.toThrow(/non-negative finite/);
    expect(repo.getAttendState).not.toHaveBeenCalled();
  });
});
