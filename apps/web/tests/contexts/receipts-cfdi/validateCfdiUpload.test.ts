/**
 * Unit tests del use-case `validateCfdiUpload` con stub del port
 * `CfdiValidator`. Cubre el mapeo del acuse SAT a veredicto: vigente,
 * cancelado, no_encontrado (N - 602) y desconocido.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("~/platform/logger/log/logger.js", () => ({
  Logger: () => ({ info() {}, warn() {}, error() {}, trace() {}, debug() {} }),
}));

import { validateCfdiUpload } from "~/contexts/receipts-cfdi/application/validateCfdiUpload.js";
import type {
  CfdiValidator,
  CfdiValidationResult,
} from "~/contexts/receipts-cfdi/domain/ports/CfdiValidator.js";

const INPUT = {
  rfcEmisor: "EKU9003173C9",
  rfcReceptor: "XAXX010101000",
  total: 1250.5,
  uuid: "A1B2C3D4-E5F6-7890-1234-567890ABCDEF",
};

function makeValidator(acuse: CfdiValidationResult): CfdiValidator {
  return { validate: vi.fn(async () => acuse) };
}

function acuseWith(estado: string, codigoEstatus = "S - Comprobante obtenido"): CfdiValidationResult {
  return {
    codigoEstatus,
    estado,
    esCancelable: "Cancelable con aceptación",
    estatusCancelacion: "",
    validacionEFOS: "200",
  };
}

describe("validateCfdiUpload", () => {
  it("mapea estado Vigente a verdict 'vigente'", async () => {
    const validator = makeValidator(acuseWith("Vigente"));
    const result = await validateCfdiUpload(INPUT, { validator });
    expect(result.verdict).toBe("vigente");
    expect(validator.validate).toHaveBeenCalledWith(INPUT);
    expect(result.acuse.estado).toBe("Vigente");
  });

  it("mapea estado Cancelado a verdict 'cancelado'", async () => {
    const result = await validateCfdiUpload(INPUT, { validator: makeValidator(acuseWith("Cancelado")) });
    expect(result.verdict).toBe("cancelado");
  });

  it("mapea codigoEstatus 'N - 602' a verdict 'no_encontrado'", async () => {
    const result = await validateCfdiUpload(INPUT, {
      validator: makeValidator(acuseWith("", "N - 602 Comprobante no encontrado")),
    });
    expect(result.verdict).toBe("no_encontrado");
  });

  it("mapea cualquier otro estado a verdict 'desconocido'", async () => {
    const result = await validateCfdiUpload(INPUT, { validator: makeValidator(acuseWith("Algo raro")) });
    expect(result.verdict).toBe("desconocido");
  });
});
