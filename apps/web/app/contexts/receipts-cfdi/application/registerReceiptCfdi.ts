/**
 * @module registerReceiptCfdi
 * @description Use-case hexagonal: registra un CFDI 4.0 nacional ligado a un
 * Receipt. Convertido desde `comprobantesService.insertarCfdi` (M9).
 *
 * Reglas de negocio:
 *  1. El Receipt debe existir (→ ReceiptNotFoundError).
 *  2. El Receipt debe estar ligado a una solicitud que permita subir comprobantes.
 *  3. El UUID no puede estar duplicado (→ CfdiAlreadyExistsError).
 *  4. Consulta al SAT (acuse no viene del cliente).
 *  5. El CFDI debe estar "Vigente" (→ SatRejectedError).
 *  6. El RFC Emisor no puede estar en lista EFOS 100/101/104 (→ EfosBlacklistedError).
 *  7. Persiste atómicamente.
 *
 * EFOS codes (SAT Consulta CFDI v1.4): 100/101/104 → emisor en lista → rechazo.
 */
import type { ComprobantesRepository } from "~/contexts/receipts-cfdi/domain/ports/ComprobantesRepository.js";
import type {
  CfdiValidator,
  CfdiValidationResult,
} from "~/contexts/receipts-cfdi/domain/ports/CfdiValidator.js";
import type { CreateCfdiData } from "~/contexts/receipts-cfdi/infrastructure/comprobantesModel.js";
import {
  ReceiptNotFoundError,
  CfdiAlreadyExistsError,
  SatRejectedError,
  EfosBlacklistedError,
  ReceiptsCfdiError,
} from "~/contexts/receipts-cfdi/domain/errors.js";

/** Códigos EFOS donde el RFC Emisor aparece en lista negra (Art. 69-B CFF). */
const EFOS_EMISOR_BLACKLISTED = ["100", "101", "104"];

/** Cuerpo CFDI 4.0 (snake_case del cliente) + sello opcional para el SAT. */
export type RegisterReceiptCfdiInput = {
  receiptId: number;
  cfdiData: {
    uuid: string;
    rfc_emisor: string;
    rfc_receptor: string;
    total: number;
    /** Sello del XML (no se persiste; sólo para el parámetro `fe` del SAT). */
    sello_emisor?: string | null;
    [field: string]: unknown;
  };
};

export type RegisterReceiptCfdiResult = { cfdiId: number };

export type RegisterReceiptCfdiDeps = {
  repo: ComprobantesRepository;
  sat: CfdiValidator;
  assertCanUpload: (requestId: number) => Promise<void> | void;
  /** Extrae los últimos 8 del Sello para el parámetro `fe` del SAT. */
  selloUltimos8: (sello: string | null | undefined) => string | null;
};

function acuseToRow(acuse: CfdiValidationResult): {
  sat_codigo_estatus: string;
  sat_estado: string;
  sat_es_cancelable: string | null;
  sat_estatus_cancelacion: string | null;
  sat_validacion_efos: string;
} {
  return {
    sat_codigo_estatus: acuse.codigoEstatus,
    sat_estado: acuse.estado,
    sat_es_cancelable: acuse.esCancelable || null,
    sat_estatus_cancelacion: acuse.estatusCancelacion || null,
    sat_validacion_efos: acuse.validacionEFOS || "200",
  };
}

export async function registerReceiptCfdi(
  input: RegisterReceiptCfdiInput,
  deps: RegisterReceiptCfdiDeps,
): Promise<RegisterReceiptCfdiResult> {
  const { receiptId, cfdiData } = input;
  const { sello_emisor: selloEmisorRaw, ...cfdiRest } = cfdiData;
  const selloUltimos8 = deps.selloUltimos8(selloEmisorRaw ?? null);

  // 1. Receipt existe.
  const receipt = await deps.repo.findReceiptById(receiptId);
  if (!receipt) {
    throw new ReceiptNotFoundError(`Receipt ${receiptId} not found`);
  }

  // 2. Ligado a solicitud + política de upload.
  if (receipt.requestId === null || receipt.requestId === undefined) {
    throw new ReceiptsCfdiError(
      "El recibo no está ligado a una solicitud de viaje",
      "RECEIPTNOTLINKED",
      400,
    );
  }
  await deps.assertCanUpload(receipt.requestId);

  // 3. UUID único.
  const existing = await deps.repo.findByUuid(cfdiRest.uuid);
  if (existing) {
    throw new CfdiAlreadyExistsError(
      `El UUID ${cfdiRest.uuid} ya fue registrado (cfdi_id: ${existing.cfdiId})`,
    );
  }

  // 4. Consulta SAT (acuse server-side).
  let acuse: CfdiValidationResult;
  try {
    acuse = await deps.sat.validate({
      rfcEmisor: cfdiRest.rfc_emisor,
      rfcReceptor: cfdiRest.rfc_receptor,
      total: cfdiRest.total,
      uuid: cfdiRest.uuid,
      selloUltimos8,
    });
  } catch (e) {
    const msg =
      (e as { message?: string })?.message === "SAT_TIMEOUT"
        ? "El servicio del SAT no respondio a tiempo. Intente mas tarde."
        : "No se pudo consultar el estado del CFDI en el SAT. Intente mas tarde.";
    throw new ReceiptsCfdiError(msg, "SATUNAVAILABLE", 503);
  }

  const satRow = acuseToRow(acuse);

  // 5. Debe estar Vigente.
  if (satRow.sat_estado !== "Vigente") {
    throw new SatRejectedError(
      satRow.sat_estado,
      `El CFDI no puede registrarse: estado SAT es "${satRow.sat_estado}"`,
    );
  }

  // 6. RFC Emisor no en lista EFOS.
  if (EFOS_EMISOR_BLACKLISTED.includes(String(satRow.sat_validacion_efos))) {
    throw new EfosBlacklistedError(
      String(satRow.sat_validacion_efos),
      `El RFC Emisor ${cfdiRest.rfc_emisor} está en la lista EFOS (código ${satRow.sat_validacion_efos}). Ver Art. 69-B CFF.`,
    );
  }

  // 7. Persistir.
  const merged = { ...cfdiRest, ...satRow } as unknown as CreateCfdiData;
  return deps.repo.createCfdi(receiptId, merged);
}
