/**
 * Unit tests de los use-cases de register de comprobante (nacional CFDI +
 * internacional) con stubs in-memory de `ComprobantesRepository` + `CfdiValidator`.
 * Paridad legacy: receipt existe, ligado, UUID único, SAT vigente, EFOS limpio.
 */
import { describe, it, expect, vi } from "vitest";
import { registerReceiptCfdi } from "~/contexts/receipts-cfdi/application/registerReceiptCfdi";
import { registerInternationalReceipt } from "~/contexts/receipts-cfdi/application/registerInternationalReceipt";
import type { ComprobantesRepository } from "~/contexts/receipts-cfdi/domain/ports/ComprobantesRepository";
import type { CfdiValidator, CfdiValidationResult } from "~/contexts/receipts-cfdi/domain/ports/CfdiValidator";
import {
  ReceiptNotFoundError,
  CfdiAlreadyExistsError,
  SatRejectedError,
  EfosBlacklistedError,
} from "~/contexts/receipts-cfdi/domain/errors";

function repo(over: Partial<ComprobantesRepository> = {}): ComprobantesRepository {
  return {
    findReceiptById: async () => ({ receiptId: 1, requestId: 7, organizationId: 101n }),
    findByUuid: async () => null,
    findCfdiByReceiptId: async () => null,
    createCfdi: vi.fn(async () => ({ cfdiId: 555 })),
    upsertReceiptWithCfdi: vi.fn(async () => ({ cfdiId: 777 })),
    getSatValidationByReceiptId: async () => null,
    ...over,
  };
}

function sat(estado = "Vigente", validacionEFOS = "200"): CfdiValidator {
  const result: CfdiValidationResult = {
    codigoEstatus: "S - Comprobante obtenido satisfactoriamente.",
    estado,
    esCancelable: "Cancelable sin aceptación",
    estatusCancelacion: "",
    validacionEFOS,
  };
  return { validate: async () => result };
}

const baseInput = {
  receiptId: 1,
  cfdiData: {
    uuid: "UUID-NAT-1",
    rfc_emisor: "AAA010101AAA",
    rfc_receptor: "BBB020202BBB",
    total: 1160,
    sello_emisor: "abcd1234",
  },
};

const deps = (over: Partial<Parameters<typeof registerReceiptCfdi>[1]> = {}) => ({
  repo: repo(),
  sat: sat(),
  assertCanUpload: vi.fn(async () => {}),
  selloUltimos8: (s: string | null | undefined) => (s ? s.slice(-8) : null),
  ...over,
});

describe("registerReceiptCfdi", () => {
  it("404 si el receipt no existe", async () => {
    await expect(
      registerReceiptCfdi(baseInput, deps({ repo: repo({ findReceiptById: async () => null }) })),
    ).rejects.toBeInstanceOf(ReceiptNotFoundError);
  });

  it("409 si el UUID ya está registrado", async () => {
    await expect(
      registerReceiptCfdi(
        baseInput,
        deps({ repo: repo({ findByUuid: async () => ({ cfdiId: 9, uuid: "UUID-NAT-1" }) }) }),
      ),
    ).rejects.toBeInstanceOf(CfdiAlreadyExistsError);
  });

  it("rechaza si el SAT no está Vigente", async () => {
    await expect(
      registerReceiptCfdi(baseInput, deps({ sat: sat("Cancelado") })),
    ).rejects.toBeInstanceOf(SatRejectedError);
  });

  it("rechaza si el RFC emisor está en lista EFOS (100/101/104)", async () => {
    await expect(
      registerReceiptCfdi(baseInput, deps({ sat: sat("Vigente", "101") })),
    ).rejects.toBeInstanceOf(EfosBlacklistedError);
  });

  it("persiste el CFDI en el happy path", async () => {
    const r = repo();
    const result = await registerReceiptCfdi(baseInput, deps({ repo: r }));
    expect(result.cfdiId).toBe(555);
    expect(r.createCfdi).toHaveBeenCalledOnce();
  });
});

describe("registerInternationalReceipt", () => {
  const intlInput = {
    receiptId: 1,
    body: {
      fecha_emision: "2026-05-01",
      descripcion: "Hotel NYC",
      total: 300,
      moneda: "usd",
      notas: "viaje",
    },
  };

  it("404 si el receipt no existe", async () => {
    await expect(
      registerInternationalReceipt(intlInput, {
        repo: repo({ findReceiptById: async () => null }),
        assertCanUpload: vi.fn(async () => {}),
      }),
    ).rejects.toBeInstanceOf(ReceiptNotFoundError);
  });

  it("409 si el recibo ya tiene comprobante", async () => {
    await expect(
      registerInternationalReceipt(intlInput, {
        repo: repo({ findCfdiByReceiptId: async () => ({ cfdiId: 3, uuid: "x" }) }),
        assertCanUpload: vi.fn(async () => {}),
      }),
    ).rejects.toBeInstanceOf(CfdiAlreadyExistsError);
  });

  it("persiste el comprobante internacional en el happy path", async () => {
    const r = repo();
    const result = await registerInternationalReceipt(intlInput, {
      repo: r,
      assertCanUpload: vi.fn(async () => {}),
    });
    expect(result.cfdiId).toBe(777);
    expect(r.upsertReceiptWithCfdi).toHaveBeenCalledOnce();
  });
});
