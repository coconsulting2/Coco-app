/**
 * @module registerInternationalReceipt
 * @description Use-case hexagonal: registra un comprobante internacional
 * (sin consulta SAT, `tipoComprobante = INTERNACIONAL`). Convertido desde
 * `comprobantesService.insertarComprobanteInternacional` (M9).
 *
 * Reglas:
 *  1. El Receipt debe existir (→ ReceiptNotFoundError).
 *  2. Ligado a una solicitud que permita subir comprobantes.
 *  3. El recibo no puede tener ya un CFDI (→ CfdiAlreadyExistsError).
 *  4. Arma un CFDI sintético con RFCs genéricos extranjeros y persiste atómico.
 */
import { randomUUID } from "node:crypto";
import type {
  ComprobantesRepository,
  UpsertInternationalArgs,
} from "~/contexts/receipts-cfdi/domain/ports/ComprobantesRepository.js";
import {
  ReceiptNotFoundError,
  CfdiAlreadyExistsError,
  ReceiptsCfdiError,
} from "~/contexts/receipts-cfdi/domain/errors.js";

export type RegisterInternationalReceiptInput = {
  receiptId: number;
  body: {
    fecha_emision: string;
    descripcion: string;
    total: number | string;
    moneda: string;
    notas?: string | null;
    receipt_type_id?: number | string | null;
  };
};

export type RegisterInternationalReceiptResult = { cfdiId: number };

export type RegisterInternationalReceiptDeps = {
  repo: ComprobantesRepository;
  assertCanUpload: (requestId: number) => Promise<void> | void;
};

export async function registerInternationalReceipt(
  input: RegisterInternationalReceiptInput,
  deps: RegisterInternationalReceiptDeps,
): Promise<RegisterInternationalReceiptResult> {
  const { receiptId, body } = input;

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

  // 3. No debe tener ya un CFDI.
  const existingCfdi = await deps.repo.findCfdiByReceiptId(receiptId);
  if (existingCfdi) {
    throw new CfdiAlreadyExistsError(
      "Este recibo ya tiene un comprobante registrado",
    );
  }

  const uuid = randomUUID();
  const fechaEmision = new Date(body.fecha_emision);
  const descripcion = String(body.descripcion).trim().slice(0, 254);
  const notas = body.notas ? String(body.notas).trim().slice(0, 240) : "";
  const total = Number(body.total);
  const moneda = String(body.moneda).toUpperCase().trim();
  const nombreReceptor = notas ? `INTERNACIONAL — ${notas}` : "INTERNACIONAL";

  const receiptUpdate: Record<string, unknown> = {
    amount: total,
    cfdiUuid: uuid,
    cfdiEmisorRfc: "XEXX010101000",
    cfdiReceptorRfc: "XAXX010101000",
    cfdiFecha: fechaEmision,
    cfdiTotal: total,
  };
  if (body.receipt_type_id) {
    receiptUpdate.receiptTypeId = Number(body.receipt_type_id);
  }

  const cfdiData: Record<string, unknown> = {
    receiptId: Number(receiptId),
    organizationId: receipt.organizationId,
    uuid,
    fechaTimbrado: fechaEmision,
    rfcPac: "XEXX010101000",
    version: "4.0",
    serie: null,
    folio: null,
    fechaEmision,
    tipoComprobante: "INTERNACIONAL",
    lugarExpedicion: "00000",
    exportacion: "01",
    metodoPago: "PUE",
    formaPago: "99",
    moneda,
    tipoCambio: 1.0,
    subtotal: total,
    descuento: 0.0,
    iva: 0.0,
    total,
    rfcEmisor: "XEXX010101000",
    nombreEmisor: descripcion,
    regimenFiscalEmisor: "616",
    rfcReceptor: "XAXX010101000",
    nombreReceptor: nombreReceptor.slice(0, 254),
    domicilioFiscalReceptor: "00000",
    regimenFiscalReceptor: "616",
    usoCfdi: "S01",
    satCodigoEstatus: "N/A",
    satEstado: "Internacional",
    satEsCancelable: null,
    satEstatusCancelacion: null,
    satValidacionEfos: "000",
  };

  const args: UpsertInternationalArgs = { receiptId, receiptUpdate, cfdiData };
  return deps.repo.upsertReceiptWithCfdi(args);
}
