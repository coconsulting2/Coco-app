/**
 * Unit test del use-case `submitReceiptsForValidation` con stub in-memory del
 * port `ReceiptValidationSubmission` — sin DB. Paridad con el legacy:
 *  - 404 si la solicitud no existe (RequestNotFoundError)
 *  - idempotente si ya está en status 7 (no muta, alreadySubmitted: true)
 *  - error de transición si el status no es 6 (InvalidStatusTransitionError)
 *  - happy path 6 → 7 (llama updateStatusToValidationStage)
 */
import { describe, it, expect, vi } from "vitest";
import { submitReceiptsForValidation } from "~/contexts/travel-requests/application/submitReceiptsForValidation";
import type { ReceiptValidationSubmission } from "~/contexts/travel-requests/domain/ports/ReceiptValidationSubmission";
import {
  RequestNotFoundError,
  InvalidStatusTransitionError,
} from "~/contexts/travel-requests/domain/errors";

function stub(status: number | null, update = vi.fn(async () => {})): ReceiptValidationSubmission {
  return {
    getRequestStatus: async () => status,
    updateStatusToValidationStage: update,
  };
}

describe("submitReceiptsForValidation", () => {
  it("lanza RequestNotFoundError si la solicitud no existe", async () => {
    await expect(
      submitReceiptsForValidation({ requestId: 99 }, { submission: stub(null) }),
    ).rejects.toBeInstanceOf(RequestNotFoundError);
  });

  it("es idempotente si ya está en status 7 (no muta)", async () => {
    const update = vi.fn(async () => {});
    const result = await submitReceiptsForValidation(
      { requestId: 1 },
      { submission: stub(7, update) },
    );
    expect(result.alreadySubmitted).toBe(true);
    expect(result.updatedStatus).toBe(7);
    expect(update).not.toHaveBeenCalled();
  });

  it("lanza InvalidStatusTransitionError si el status no es 6", async () => {
    await expect(
      submitReceiptsForValidation({ requestId: 1 }, { submission: stub(4) }),
    ).rejects.toBeInstanceOf(InvalidStatusTransitionError);
  });

  it("transiciona 6 → 7 en el happy path", async () => {
    const update = vi.fn(async () => {});
    const result = await submitReceiptsForValidation(
      { requestId: 1 },
      { submission: stub(6, update) },
    );
    expect(result.alreadySubmitted).toBe(false);
    expect(result.updatedStatus).toBe(7);
    expect(update).toHaveBeenCalledOnce();
  });
});
