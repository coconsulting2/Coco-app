/**
 * @module comprobantesModel
 * @description Data access layer (Prisma) para CFDI 4.0 comprobantes.
 * Convertido a TS proper en M9 — antes carecia de chequeo de tipos.
 * @author Hector Lugo
 */
import prisma from "~/platform/db/prisma.server.js";
import { Prisma, type CfdiComprobante, type Receipt } from "@coco/db";

/** Row snake_case del acuse SAT que `updateSatAcuseByReceiptId` espera. */
export type SatAcuseRow = {
  sat_codigo_estatus: string;
  sat_estado: string;
  sat_es_cancelable?: string | null;
  sat_estatus_cancelacion?: string | null;
  sat_validacion_efos: string;
};

/**
 * Campos CFDI 4.0 (snake_case del cliente) + acuse SAT mergeado.
 * Se mantiene laxo porque el body del cliente es dinámico; los campos
 * obligatorios para persistir se documentan en `createCfdi`.
 */
export type CreateCfdiData = {
  uuid: string;
  fecha_timbrado: string | Date;
  rfc_pac: string;
  version?: string;
  serie?: string | null;
  folio?: string | null;
  fecha_emision: string | Date;
  tipo_comprobante: string;
  lugar_expedicion: string;
  exportacion?: string;
  metodo_pago: string;
  forma_pago: string;
  moneda?: string;
  tipo_cambio?: number;
  subtotal: number;
  descuento?: number;
  iva?: number;
  impuestos?: unknown;
  total_retenidos?: number;
  total: number;
  rfc_emisor: string;
  nombre_emisor: string;
  regimen_fiscal_emisor: string;
  rfc_receptor: string;
  nombre_receptor: string;
  domicilio_fiscal_receptor: string;
  regimen_fiscal_receptor: string;
  uso_cfdi: string;
  sat_codigo_estatus: string;
  sat_estado: string;
  sat_es_cancelable?: string | null;
  sat_estatus_cancelacion?: string | null;
  sat_validacion_efos: string;
};

const ComprobantesModel = {
  /** Find a CFDI by its UUID (Folio Fiscal). Enforces uniqueness before insert. */
  async findByUUID(uuid: string): Promise<CfdiComprobante | null> {
    return prisma.cfdiComprobante.findUnique({ where: { uuid } });
  },

  /** Verify that a Receipt exists before associating a CFDI to it. */
  async findReceiptById(receiptId: number): Promise<Receipt | null> {
    return prisma.receipt.findUnique({ where: { receiptId } });
  },

  /** Último estado SAT del CFDI ligado al recibo. */
  async getSatValidationByReceiptId(
    receiptId: number,
  ): Promise<{ satEstado: string; createdAt: Date } | null> {
    return prisma.cfdiComprobante.findUnique({
      where: { receiptId: Number(receiptId) },
      select: { satEstado: true, createdAt: true },
    });
  },

  /** Actualiza solo los campos de acuse SAT para el CFDI ligado al recibo. */
  async updateSatAcuseByReceiptId(
    receiptId: number,
    data: SatAcuseRow,
  ): Promise<CfdiComprobante | null> {
    const row = await prisma.cfdiComprobante.findUnique({
      where: { receiptId: Number(receiptId) },
    });
    if (!row) {
      return null;
    }
    return prisma.cfdiComprobante.update({
      where: { receiptId: Number(receiptId) },
      data: {
        satCodigoEstatus: data.sat_codigo_estatus,
        satEstado: data.sat_estado,
        satEsCancelable: data.sat_es_cancelable ?? null,
        satEstatusCancelacion: data.sat_estatus_cancelacion ?? null,
        satValidacionEfos: data.sat_validacion_efos,
      },
    });
  },

  /**
   * Insert a new CfdiComprobante linked to a Receipt atomically.
   * Uses `prisma.$transaction` to guarantee full rollback on any failure.
   */
  async createCfdi(
    receiptId: number,
    data: CreateCfdiData,
  ): Promise<CfdiComprobante> {
    // `organizationId` lo inyecta el tenantExtension en runtime; TS no lo sabe,
    // así que construimos el input y casteamos al UncheckedCreateInput de Prisma
    // (mismo patrón que `PrismaAuthorizerRepository`).
    const createData = {
      receiptId,
      // --- TimbreFiscalDigital ---
      uuid: data.uuid,
      fechaTimbrado: new Date(data.fecha_timbrado),
      rfcPac: data.rfc_pac,
      // --- Comprobante ---
      version: data.version ?? "4.0",
      serie: data.serie ?? null,
      folio: data.folio ?? null,
      fechaEmision: new Date(data.fecha_emision),
      tipoComprobante: data.tipo_comprobante,
      lugarExpedicion: data.lugar_expedicion,
      exportacion: data.exportacion ?? "01",
      metodoPago: data.metodo_pago,
      formaPago: data.forma_pago,
      moneda: data.moneda ?? "MXN",
      tipoCambio: data.tipo_cambio ?? 1.0,
      subtotal: data.subtotal,
      descuento: data.descuento ?? 0.0,
      iva: data.iva ?? 0.0,
      impuestos:
        data.impuestos === undefined
          ? undefined
          : (data.impuestos as Prisma.InputJsonValue),
      totalRetenidos: data.total_retenidos ?? 0.0,
      total: data.total,
      // --- Emisor ---
      rfcEmisor: data.rfc_emisor,
      nombreEmisor: data.nombre_emisor,
      regimenFiscalEmisor: data.regimen_fiscal_emisor,
      // --- Receptor ---
      rfcReceptor: data.rfc_receptor,
      nombreReceptor: data.nombre_receptor,
      domicilioFiscalReceptor: data.domicilio_fiscal_receptor,
      regimenFiscalReceptor: data.regimen_fiscal_receptor,
      usoCfdi: data.uso_cfdi,
      // --- Acuse SAT ---
      satCodigoEstatus: data.sat_codigo_estatus,
      satEstado: data.sat_estado,
      satEsCancelable: data.sat_es_cancelable ?? null,
      satEstatusCancelacion: data.sat_estatus_cancelacion ?? null,
      satValidacionEfos: data.sat_validacion_efos,
    } as unknown as Prisma.CfdiComprobanteUncheckedCreateInput;

    return prisma.$transaction(async (tx) => {
      return tx.cfdiComprobante.create({ data: createData });
    });
  },
};

export default ComprobantesModel;
