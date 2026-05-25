/**
 * Unit tests del use-case `markAttended` con un stub del puerto
 * `AgencyAttendRepository`. Verifica el avance a status 6 y el error cuando la
 * Request no existe (paridad con `attendTravelRequest`).
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("~/platform/logger/log/logger.js", () => ({
  Logger: () => ({ info() {}, warn() {}, error() {}, trace() {}, debug() {} }),
}));

import { markAttended } from "~/contexts/travel-agency/application/markAttended.js";
import { AttentionNotFoundError } from "~/contexts/travel-agency/domain/errors.js";
import type { AgencyAttendRepository } from "~/contexts/travel-agency/domain/ports/AgencyAttendRepository.js";

function makeRepo(exists: boolean): AgencyAttendRepository {
  return {
    requestExists: vi.fn(async () => exists),
    markAttended: vi.fn(async () => undefined),
  };
}

describe("markAttended", () => {
  it("avanza la Request a status 6 cuando existe", async () => {
    const attendRepo = makeRepo(true);

    const result = await markAttended({ requestId: 11 }, { attendRepo });

    expect(attendRepo.requestExists).toHaveBeenCalledWith(11);
    expect(attendRepo.markAttended).toHaveBeenCalledWith(11);
    expect(result).toEqual({ newStatusId: 6 });
  });

  it("lanza AttentionNotFoundError cuando la Request no existe", async () => {
    const attendRepo = makeRepo(false);

    await expect(
      markAttended({ requestId: 99 }, { attendRepo }),
    ).rejects.toBeInstanceOf(AttentionNotFoundError);
    expect(attendRepo.markAttended).not.toHaveBeenCalled();
  });
});
