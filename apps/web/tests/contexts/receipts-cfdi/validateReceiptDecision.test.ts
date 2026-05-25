/**
 * Unit test del use-case `validateReceiptDecision` con stubs in-memory para
 * cada port — sin DB, sin SAT real. Cubre los caminos críticos del legacy:
 * approve/reject, comentario obligatorio, deadline expirado, CFDI ausente,
 * SAT no-vigente, EFOS blacklist, ya-decidido, persist failure, comment-fail-non-blocking.
 */
import { describe, it, expect, vi } from "vitest";

// El use-case importa (transitivamente) el logger pino, cuyo transport falla
// al inicializarse bajo vitest/node. Lo aislamos con un stub no-op.
vi.mock("~/platform/logger/log/logger.js", () => ({
  Logger: () => ({
    info: () => {},
    warn: () => {},
    error: () => {},
    trace: () => {},
    debug: () => {},
  }),
}));

import { validateReceiptDecision } from "~/contexts/receipts-cfdi/application/validateReceiptDecision";
import type {
  ValidateReceiptDecisionDeps,
} from "~/contexts/receipts-cfdi/application/validateReceiptDecision";
import type {
  ReceiptDecision,
  ReceiptForValidation,
} from "~/contexts/receipts-cfdi/domain/entities/ReceiptValidation";
import type { CfdiValidationResult } from "~/contexts/receipts-cfdi/domain/ports/CfdiValidator";
import {
  CommentRequiredError,
  EfosBlacklistedError,
  InvalidDecisionError,
  ReceiptAlreadyDecidedError,
  ReceiptDeadlinePassedError,
  ReceiptMissingCfdiError,
  ReceiptNotFoundError,
  ReceiptValidationPersistError,
  SatRejectedError,
} from "~/contexts/receipts-cfdi/domain/errors";

const RECEIPT_ID = 42;
const REQUEST_ID = 1001;
const USER_ID = 7;

const fullCfdi = {
  rfcEmisor: "AAA010101AAA",
  rfcReceptor: "BBB020202BBB",
  total: 1500,
  uuid: "1234-uuid",
};

const baseReceipt: ReceiptForValidation = {
  receiptId: RECEIPT_ID,
  requestId: REQUEST_ID,
  validation: "Pendiente",
  receiptTypeName: "Hospedaje",
  cfdiComprobante: fullCfdi,
};

const acuseVigente: CfdiValidationResult = {
  codigoEstatus: "S - Comprobante obtenido satisfactoriamente.",
  estado: "Vigente",
  esCancelable: "Cancelable con aceptación",
  estatusCancelacion: "",
  validacionEFOS: "200",
};

function buildDeps(overrides: Partial<ValidateReceiptDecisionDeps> = {}): ValidateReceiptDecisionDeps {
  return {
    receipts: {
      findForValidation: vi.fn().mockResolvedValue(baseReceipt),
      setValidation: vi.fn().mockResolvedValue(true),
      listForRequest: vi.fn().mockResolvedValue(null),
    },
    cfdiValidator: {
      validate: vi.fn().mockResolvedValue(acuseVigente),
    },
    cfdiAcuse: {
      updateAcuseByReceiptId: vi.fn().mockResolvedValue(undefined),
    },
    comments: {
      postRequestComment: vi.fn().mockResolvedValue({ success: true }),
    },
    deadline: {
      isWithinDeadline: vi.fn().mockResolvedValue(true),
    },
    lifecycle: {
      syncRequestStatusAfterReceiptDecision: vi.fn().mockResolvedValue({
        updatedStatus: 8,
        message: "All receipts approved. Request finalized.",
      }),
    },
    ...overrides,
  } as ValidateReceiptDecisionDeps;
}

describe("validateReceiptDecision — approve happy path", () => {
  it("aprueba un receipt con CFDI vigente + EFOS limpio + dentro de deadline", async () => {
    const deps = buildDeps();
    const result = await validateReceiptDecision(
      { receiptId: RECEIPT_ID, decision: "approve", userId: USER_ID },
      deps,
    );
    expect(result.newValidation).toBe("Aprobado");
    expect(result.satAcuse?.estado).toBe("Vigente");
    expect(result.commentPosted).toBe(false);
    expect(result.lifecycleSync.updatedStatus).toBe(8);
    expect(deps.cfdiAcuse.updateAcuseByReceiptId).toHaveBeenCalledTimes(1);
    expect(deps.receipts.setValidation).toHaveBeenCalledWith(RECEIPT_ID, "approve");
    expect(deps.lifecycle.syncRequestStatusAfterReceiptDecision).toHaveBeenCalledWith(REQUEST_ID);
    expect(deps.comments.postRequestComment).not.toHaveBeenCalled();
  });
});

describe("validateReceiptDecision — reject happy path", () => {
  it("rechaza con comentario obligatorio + publica al chat", async () => {
    const deps = buildDeps();
    const result = await validateReceiptDecision(
      {
        receiptId: RECEIPT_ID,
        decision: "reject",
        comment: "  Folio fiscal inválido  ",
        userId: USER_ID,
      },
      deps,
    );
    expect(result.newValidation).toBe("Rechazado");
    expect(result.commentPosted).toBe(true);
    expect(deps.comments.postRequestComment).toHaveBeenCalledWith({
      userId: USER_ID,
      requestId: REQUEST_ID,
      content: "Comprobante «Hospedaje» rechazado: Folio fiscal inválido",
    });
    // Reject NO consulta SAT ni escribe acuse
    expect(deps.cfdiValidator.validate).not.toHaveBeenCalled();
    expect(deps.cfdiAcuse.updateAcuseByReceiptId).not.toHaveBeenCalled();
    // Pero SÍ sincroniza status
    expect(deps.lifecycle.syncRequestStatusAfterReceiptDecision).toHaveBeenCalledWith(REQUEST_ID);
  });

  it("usa '#<receiptId>' cuando receipt_type_name es null", async () => {
    const deps = buildDeps({
      receipts: {
        findForValidation: vi.fn().mockResolvedValue({ ...baseReceipt, receiptTypeName: null }),
        setValidation: vi.fn().mockResolvedValue(true),
        listForRequest: vi.fn().mockResolvedValue(null),
      },
    });
    await validateReceiptDecision(
      { receiptId: RECEIPT_ID, decision: "reject", comment: "x", userId: USER_ID },
      deps,
    );
    expect(deps.comments.postRequestComment).toHaveBeenCalledWith(
      expect.objectContaining({ content: `Comprobante #${RECEIPT_ID} rechazado: x` }),
    );
  });

  it("persiste el rechazo aunque el comentario falle (no aborta)", async () => {
    const deps = buildDeps({
      comments: {
        postRequestComment: vi.fn().mockResolvedValue({ success: false, error: "FK violation" }),
      },
    });
    const result = await validateReceiptDecision(
      { receiptId: RECEIPT_ID, decision: "reject", comment: "x", userId: USER_ID },
      deps,
    );
    expect(result.newValidation).toBe("Rechazado");
    expect(result.commentPosted).toBe(false);
  });
});

describe("validateReceiptDecision — validation errors", () => {
  it("rechaza decision inválida", async () => {
    const deps = buildDeps();
    await expect(
      validateReceiptDecision(
        { receiptId: RECEIPT_ID, decision: "wrong" as unknown as ReceiptDecision, userId: USER_ID },
        deps,
      ),
    ).rejects.toBeInstanceOf(InvalidDecisionError);
  });

  it("rechaza reject sin comentario", async () => {
    const deps = buildDeps();
    await expect(
      validateReceiptDecision(
        { receiptId: RECEIPT_ID, decision: "reject", comment: "   ", userId: USER_ID },
        deps,
      ),
    ).rejects.toBeInstanceOf(CommentRequiredError);
  });

  it("rechaza receipt inexistente", async () => {
    const deps = buildDeps({
      receipts: {
        findForValidation: vi.fn().mockResolvedValue(null),
        setValidation: vi.fn(),
        listForRequest: vi.fn(),
      },
    });
    await expect(
      validateReceiptDecision({ receiptId: RECEIPT_ID, decision: "approve", userId: USER_ID }, deps),
    ).rejects.toBeInstanceOf(ReceiptNotFoundError);
  });

  it("rechaza receipt ya decidido (no Pendiente)", async () => {
    const deps = buildDeps({
      receipts: {
        findForValidation: vi.fn().mockResolvedValue({ ...baseReceipt, validation: "Aprobado" }),
        setValidation: vi.fn(),
        listForRequest: vi.fn(),
      },
    });
    await expect(
      validateReceiptDecision({ receiptId: RECEIPT_ID, decision: "approve", userId: USER_ID }, deps),
    ).rejects.toBeInstanceOf(ReceiptAlreadyDecidedError);
  });
});

describe("validateReceiptDecision — approve guardrails", () => {
  it("rechaza si pasó el deadline", async () => {
    const deps = buildDeps({
      deadline: { isWithinDeadline: vi.fn().mockResolvedValue(false) },
    });
    await expect(
      validateReceiptDecision({ receiptId: RECEIPT_ID, decision: "approve", userId: USER_ID }, deps),
    ).rejects.toBeInstanceOf(ReceiptDeadlinePassedError);
  });

  it("rechaza si receipt no tiene CFDI", async () => {
    const deps = buildDeps({
      receipts: {
        findForValidation: vi.fn().mockResolvedValue({ ...baseReceipt, cfdiComprobante: null }),
        setValidation: vi.fn(),
        listForRequest: vi.fn(),
      },
    });
    await expect(
      validateReceiptDecision({ receiptId: RECEIPT_ID, decision: "approve", userId: USER_ID }, deps),
    ).rejects.toBeInstanceOf(ReceiptMissingCfdiError);
  });

  it("rechaza si SAT reporta estado != Vigente (pero persiste acuse)", async () => {
    const acuseCancelado: CfdiValidationResult = { ...acuseVigente, estado: "Cancelado" };
    const deps = buildDeps({
      cfdiValidator: { validate: vi.fn().mockResolvedValue(acuseCancelado) },
    });
    await expect(
      validateReceiptDecision({ receiptId: RECEIPT_ID, decision: "approve", userId: USER_ID }, deps),
    ).rejects.toBeInstanceOf(SatRejectedError);
    // El acuse SÍ se persistió antes de rechazar (audit trail)
    expect(deps.cfdiAcuse.updateAcuseByReceiptId).toHaveBeenCalledTimes(1);
  });

  it("rechaza si EFOS del emisor está en blacklist", async () => {
    const acuseEfos: CfdiValidationResult = { ...acuseVigente, validacionEFOS: "100" };
    const deps = buildDeps({
      cfdiValidator: { validate: vi.fn().mockResolvedValue(acuseEfos) },
    });
    await expect(
      validateReceiptDecision({ receiptId: RECEIPT_ID, decision: "approve", userId: USER_ID }, deps),
    ).rejects.toBeInstanceOf(EfosBlacklistedError);
  });
});

describe("validateReceiptDecision — persistence failure", () => {
  it("lanza ReceiptValidationPersistError si setValidation devuelve false", async () => {
    const deps = buildDeps({
      receipts: {
        findForValidation: vi.fn().mockResolvedValue(baseReceipt),
        setValidation: vi.fn().mockResolvedValue(false),
        listForRequest: vi.fn(),
      },
    });
    await expect(
      validateReceiptDecision({ receiptId: RECEIPT_ID, decision: "approve", userId: USER_ID }, deps),
    ).rejects.toBeInstanceOf(ReceiptValidationPersistError);
  });
});
