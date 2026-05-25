/**
 * Unit test del use-case `createTravelRequest` con stubs in-memory para los
 * dos ports — sin DB, sin slice policies real. Cubre:
 *  - happy path (policy OK + creator devuelve requestId)
 *  - paridad legacy: policy.assertFeeWithinPolicy se invoca ANTES de creator
 *  - error de policy (ViaticasPolicyExceededError) aborta antes de persistir
 *  - validación de input (missing applicantUserId, missing mainRoute, missing
 *    campos críticos del leg)
 */
import { describe, it, expect, vi } from "vitest";
import { createTravelRequest } from "~/contexts/travel-requests/application/createTravelRequest";
import type { CreateTravelRequestDeps } from "~/contexts/travel-requests/application/createTravelRequest";
import type {
  CreateTravelRequestInput,
  RouteLeg,
} from "~/contexts/travel-requests/domain/entities/Request";
import {
  InvalidTravelRequestInputError,
  ViaticasPolicyExceededError,
} from "~/contexts/travel-requests/domain/errors";

const validLeg: Omit<RouteLeg, "routerIndex"> = {
  originCountryName: "México",
  originCityName: "CDMX",
  destinationCountryName: "EUA",
  destinationCityName: "NYC",
  beginningDate: "2026-06-01",
  beginningTime: "08:00",
  endingDate: "2026-06-05",
  endingTime: "18:00",
  hotelNeeded: true,
  planeNeeded: true,
};

const validInput: CreateTravelRequestInput = {
  applicantUserId: 42,
  notes: "Conferencia",
  requestedFee: 5000,
  mainRoute: validLeg,
  additionalRoutes: [],
};

function buildDeps(overrides: Partial<CreateTravelRequestDeps> = {}): CreateTravelRequestDeps {
  return {
    policy: {
      assertFeeWithinPolicy: vi.fn().mockResolvedValue(undefined),
    },
    creator: {
      create: vi.fn().mockResolvedValue({ requestId: 7001 }),
    },
    ...overrides,
  };
}

describe("createTravelRequest — happy path", () => {
  it("invoca policy.assertFeeWithinPolicy con el shape correcto y luego creator.create", async () => {
    const deps = buildDeps();
    const result = await createTravelRequest(validInput, deps);
    expect(result.requestId).toBe(7001);
    expect(deps.policy.assertFeeWithinPolicy).toHaveBeenCalledWith({
      applicantUserId: 42,
      requestedFee: 5000,
      hotelNeeded: true,
    });
    expect(deps.creator.create).toHaveBeenCalledWith(validInput);
    // Orden: policy primero, creator después
    const policyOrder = (deps.policy.assertFeeWithinPolicy as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    const creatorOrder = (deps.creator.create as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    expect(policyOrder).toBeLessThan(creatorOrder);
  });

  it("default requestedFee=0 cuando no se provee", async () => {
    const deps = buildDeps();
    const input = { ...validInput, requestedFee: undefined };
    await createTravelRequest(input, deps);
    expect(deps.policy.assertFeeWithinPolicy).toHaveBeenCalledWith(
      expect.objectContaining({ requestedFee: 0 }),
    );
  });
});

describe("createTravelRequest — policy guard", () => {
  it("propaga ViaticasPolicyExceededError y NO llama creator", async () => {
    const policyErr = new ViaticasPolicyExceededError("Tope excedido por $1000");
    const deps = buildDeps({
      policy: {
        assertFeeWithinPolicy: vi.fn().mockRejectedValue(policyErr),
      },
    });
    await expect(createTravelRequest(validInput, deps)).rejects.toBe(policyErr);
    expect(deps.creator.create).not.toHaveBeenCalled();
  });
});

describe("createTravelRequest — input validation", () => {
  it("rechaza applicantUserId inválido", async () => {
    const deps = buildDeps();
    await expect(
      createTravelRequest({ ...validInput, applicantUserId: 0 }, deps),
    ).rejects.toBeInstanceOf(InvalidTravelRequestInputError);
    expect(deps.policy.assertFeeWithinPolicy).not.toHaveBeenCalled();
  });

  it("rechaza mainRoute ausente", async () => {
    const deps = buildDeps();
    const input = { ...validInput };
    // @ts-expect-error — intencionalmente quitamos mainRoute para forzar el throw
    delete input.mainRoute;
    await expect(createTravelRequest(input, deps)).rejects.toBeInstanceOf(
      InvalidTravelRequestInputError,
    );
  });

  it("rechaza mainRoute con originCountryName vacío", async () => {
    const deps = buildDeps();
    const input: CreateTravelRequestInput = {
      ...validInput,
      mainRoute: { ...validLeg, originCountryName: "" },
    };
    await expect(createTravelRequest(input, deps)).rejects.toBeInstanceOf(
      InvalidTravelRequestInputError,
    );
  });

  it("rechaza mainRoute con beginningDate vacío", async () => {
    const deps = buildDeps();
    const input: CreateTravelRequestInput = {
      ...validInput,
      mainRoute: { ...validLeg, beginningDate: "" },
    };
    await expect(createTravelRequest(input, deps)).rejects.toBeInstanceOf(
      InvalidTravelRequestInputError,
    );
  });
});
