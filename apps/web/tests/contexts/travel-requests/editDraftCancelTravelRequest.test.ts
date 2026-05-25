/**
 * Unit tests de los use-cases de edición/borrador/cancelación con stubs
 * in-memory de los ports — sin DB.
 */
import { describe, it, expect, vi } from "vitest";
import { editTravelRequest } from "~/contexts/travel-requests/application/editTravelRequest";
import {
  createDraftTravelRequest,
  confirmDraftTravelRequest,
} from "~/contexts/travel-requests/application/draftTravelRequest";
import { cancelTravelRequest } from "~/contexts/travel-requests/application/cancelTravelRequest";
import type { TravelRequestEditor } from "~/contexts/travel-requests/domain/ports/TravelRequestEditor";
import type { TravelRequestDraftWriter } from "~/contexts/travel-requests/domain/ports/TravelRequestDraftWriter";
import type { TravelRequestCanceller } from "~/contexts/travel-requests/domain/ports/TravelRequestCanceller";
import {
  InvalidTravelRequestInputError,
  RequestNotFoundError,
  RequestNotCancellableError,
} from "~/contexts/travel-requests/domain/errors";
import type { EditTravelRequestInput } from "~/contexts/travel-requests/domain/entities/Request";

const baseEdit: EditTravelRequestInput = {
  requestId: 10,
  notes: "x",
  requestedFee: 100,
  mainRoute: {
    originCountryName: "México",
    originCityName: "CDMX",
    destinationCountryName: "EUA",
    destinationCityName: "NYC",
    beginningDate: "2026-06-01",
    beginningTime: "08:00",
    endingDate: "2026-06-05",
    endingTime: "18:00",
    planeNeeded: true,
    hotelNeeded: true,
  },
};

describe("editTravelRequest", () => {
  it("rechaza requestId inválido", async () => {
    const editor: TravelRequestEditor = { edit: vi.fn() };
    await expect(
      editTravelRequest({ ...baseEdit, requestId: 0 }, { editor }),
    ).rejects.toBeInstanceOf(InvalidTravelRequestInputError);
    expect(editor.edit).not.toHaveBeenCalled();
  });

  it("delega en el editor en el happy path", async () => {
    const editor: TravelRequestEditor = { edit: vi.fn(async () => ({ requestId: 10 })) };
    const result = await editTravelRequest(baseEdit, { editor });
    expect(result.requestId).toBe(10);
    expect(editor.edit).toHaveBeenCalledOnce();
  });
});

describe("createDraftTravelRequest / confirmDraftTravelRequest", () => {
  function draftWriter(): TravelRequestDraftWriter {
    return {
      createDraft: vi.fn(async () => ({ requestId: 20 })),
      confirmDraft: vi.fn(async () => ({ requestId: 20 })),
    };
  }

  it("createDraft rechaza userId inválido", async () => {
    const dw = draftWriter();
    await expect(
      createDraftTravelRequest(0, {}, { draftWriter: dw }),
    ).rejects.toBeInstanceOf(InvalidTravelRequestInputError);
  });

  it("createDraft delega con partial", async () => {
    const dw = draftWriter();
    const result = await createDraftTravelRequest(5, { notes: "wip" }, { draftWriter: dw });
    expect(result.requestId).toBe(20);
    expect(dw.createDraft).toHaveBeenCalledWith(5, { notes: "wip" });
  });

  it("confirmDraft rechaza requestId inválido", async () => {
    const dw = draftWriter();
    await expect(
      confirmDraftTravelRequest(5, 0, { draftWriter: dw }),
    ).rejects.toBeInstanceOf(InvalidTravelRequestInputError);
  });

  it("confirmDraft delega en el happy path", async () => {
    const dw = draftWriter();
    const result = await confirmDraftTravelRequest(5, 20, { draftWriter: dw });
    expect(result.requestId).toBe(20);
    expect(dw.confirmDraft).toHaveBeenCalledWith(5, 20);
  });
});

describe("cancelTravelRequest", () => {
  function canceller(status: number | null, cancel = vi.fn(async () => {})): TravelRequestCanceller {
    return { getRequestStatus: async () => status, cancel };
  }

  it("lanza RequestNotFoundError si no existe", async () => {
    await expect(
      cancelTravelRequest({ requestId: 1 }, { canceller: canceller(null) }),
    ).rejects.toBeInstanceOf(RequestNotFoundError);
  });

  it("no cancela tras Atención Agencia (status 6)", async () => {
    const cancel = vi.fn(async () => {});
    await expect(
      cancelTravelRequest({ requestId: 1 }, { canceller: canceller(6, cancel) }),
    ).rejects.toBeInstanceOf(RequestNotCancellableError);
    expect(cancel).not.toHaveBeenCalled();
  });

  it("rechaza si ya está cancelada (status 9)", async () => {
    await expect(
      cancelTravelRequest({ requestId: 1 }, { canceller: canceller(9) }),
    ).rejects.toBeInstanceOf(RequestNotCancellableError);
  });

  it("cancela en el happy path (status 2 → 9)", async () => {
    const cancel = vi.fn(async () => {});
    const result = await cancelTravelRequest({ requestId: 1 }, { canceller: canceller(2, cancel) });
    expect(result).toEqual({ requestId: 1, requestStatusId: 9, active: false });
    expect(cancel).toHaveBeenCalledOnce();
  });
});
