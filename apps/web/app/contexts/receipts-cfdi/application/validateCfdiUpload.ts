/**
 * @module validateCfdiUpload
 * @description Use-case puro con DI: valida un CFDI contra el SAT y
 * traduce el acuse a un veredicto (vigente / cancelado / desconocido).
 *
 * El veredicto es el único contrato que ven los callers — el detalle del
 * acuse (códigos SAT, EFOS) queda disponible para audit pero la decisión
 * de aprobar/rechazar la toma el caller.
 */
import type {
  CfdiValidationInput,
  CfdiValidator,
} from "~/contexts/receipts-cfdi/domain/ports/CfdiValidator.js";

export type ValidateCfdiUploadInput = CfdiValidationInput;

export type ValidateCfdiUploadDeps = { validator: CfdiValidator };

export type CfdiVerdict = "vigente" | "cancelado" | "no_encontrado" | "desconocido";

export type ValidateCfdiUploadResult = {
  verdict: CfdiVerdict;
  acuse: {
    codigoEstatus: string;
    estado: string;
    esCancelable: string;
    estatusCancelacion: string;
    validacionEFOS: string;
  };
};

function mapVerdict(estado: string, codigoEstatus: string): CfdiVerdict {
  const norm = estado.trim().toLowerCase();
  if (norm === "vigente") return "vigente";
  if (norm === "cancelado") return "cancelado";
  if (codigoEstatus.includes("N - 602")) return "no_encontrado";
  return "desconocido";
}

export async function validateCfdiUpload(
  input: ValidateCfdiUploadInput,
  deps: ValidateCfdiUploadDeps,
): Promise<ValidateCfdiUploadResult> {
  const acuse = await deps.validator.validate(input);
  return {
    verdict: mapVerdict(acuse.estado, acuse.codigoEstatus),
    acuse,
  };
}
