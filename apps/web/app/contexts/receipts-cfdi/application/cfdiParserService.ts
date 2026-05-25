/**
 * @module cfdiParserService
 * @description Parses SAT CFDI v3.3 and v4.0 XML files using fast-xml-parser.
 * Extracts RFC emisor, receptor, fecha, total, UUID and desglosed taxes.
 * Validates document structure before extraction.
 */
import { XMLParser } from "fast-xml-parser";
import {
  buildImpuestosFromTaxesBreakdown,
  sumIvaTrasladadoFromImpuestos,
  sumRetencionesFromImpuestos,
  type CfdiTrasladoBreakdown,
  type CfdiRetencionBreakdown,
  type CfdiTaxesBreakdown,
} from "~/contexts/receipts-cfdi/application/cfdiImpuestos.js";

const SUPPORTED_VERSIONS = ["3.3", "4.0"] as const;

/** Estructura fiscal extraída de un CFDI timbrado. */
export type ParsedCfdi = {
  version: string;
  rfcEmisor: string;
  rfcReceptor: string | null;
  fecha: Date;
  total: number;
  uuid: string;
  sello: string | null;
  selloUltimos8: string | null;
  taxes: CfdiTaxesBreakdown;
};

/**
 * Ultimos 8 caracteres del Sello del emisor (parametro `fe` en expresion impresa SAT).
 */
export function selloUltimos8FromSello(sello: string | null | undefined): string | null {
  if (!sello || typeof sello !== "string") {
    return null;
  }
  const t = sello.trim();
  if (t.length < 8) {
    return null;
  }
  return t.slice(-8);
}

/** Maps CFDI impuesto code to human-readable name. */
const IMPUESTO_NOMBRES: Record<string, string> = {
  "001": "ISR",
  "002": "IVA",
  "003": "IEPS",
};

/** Structured error for CFDI parsing failures. */
export class CfdiParseError extends Error {
  /** Machine-readable error code. */
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "CfdiParseError";
    this.code = code;
  }
}

/**
 * Nodo XML parseado: los atributos llevan prefijo `@_`, los hijos son objetos
 * anidados. El parser es dinámico, así que indexamos por string con valor `unknown`.
 */
type XmlNode = { [key: string]: unknown };

function asNode(value: unknown): XmlNode | undefined {
  return value && typeof value === "object" ? (value as XmlNode) : undefined;
}

function attr(node: XmlNode | undefined, name: string): string | undefined {
  if (!node) return undefined;
  const v = node[name];
  return v === undefined || v === null ? undefined : String(v);
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseAttributeValue: false,
  trimValues: true,
  isArray: (tagName: string) => ["Traslado", "Retencion", "Concepto"].includes(tagName),
});

function getComprobanteRoot(parsed: unknown): XmlNode | undefined {
  const root = asNode(parsed);
  if (!root) {
    return undefined;
  }
  return (
    asNode(root.Comprobante) ??
    asNode(root.comprobante) ??
    asNode(root["cfdi:Comprobante"]) ??
    undefined
  );
}

/**
 * Parses a CFDI XML string and returns extracted fiscal data.
 * @throws {CfdiParseError} If the XML structure is invalid or required fields are missing.
 */
export function parseCFDI(xmlString: string): ParsedCfdi {
  if (!xmlString || typeof xmlString !== "string" || !xmlString.trim()) {
    throw new CfdiParseError("El contenido XML está vacío", "EMPTY_XML");
  }

  let parsed: unknown;
  try {
    parsed = parser.parse(xmlString);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new CfdiParseError(`XML malformado: ${message}`, "INVALID_XML");
  }

  const comprobante = getComprobanteRoot(parsed);
  if (!comprobante) {
    throw new CfdiParseError(
      "Nodo cfdi:Comprobante no encontrado. Verifique que el XML sea un CFDI válido.",
      "MISSING_COMPROBANTE",
    );
  }

  const version = attr(comprobante, "@_Version");
  if (!version) {
    throw new CfdiParseError(
      "Atributo Version no encontrado en cfdi:Comprobante",
      "MISSING_VERSION",
    );
  }
  if (!SUPPORTED_VERSIONS.includes(version as (typeof SUPPORTED_VERSIONS)[number])) {
    throw new CfdiParseError(
      `Versión CFDI '${version}' no soportada. Versiones válidas: ${SUPPORTED_VERSIONS.join(", ")}`,
      "UNSUPPORTED_VERSION",
    );
  }

  const emisor = asNode(comprobante.Emisor);
  if (!emisor) {
    throw new CfdiParseError("Nodo cfdi:Emisor no encontrado", "MISSING_EMISOR");
  }
  const rfcEmisor = attr(emisor, "@_Rfc");
  if (!rfcEmisor) {
    throw new CfdiParseError(
      "Atributo Rfc no encontrado en cfdi:Emisor",
      "MISSING_RFC_EMISOR",
    );
  }

  const receptor = asNode(comprobante.Receptor);
  const rfcReceptor = attr(receptor, "@_Rfc") ?? null;

  const fecha = attr(comprobante, "@_Fecha");
  if (!fecha) {
    throw new CfdiParseError(
      "Atributo Fecha no encontrado en cfdi:Comprobante",
      "MISSING_FECHA",
    );
  }
  const fechaDate = new Date(fecha);
  if (isNaN(fechaDate.getTime())) {
    throw new CfdiParseError(`Fecha '${fecha}' no es una fecha ISO válida`, "INVALID_FECHA");
  }

  const totalRaw = comprobante["@_Total"];
  if (totalRaw === undefined || totalRaw === null || totalRaw === "") {
    throw new CfdiParseError(
      "Atributo Total no encontrado en cfdi:Comprobante",
      "MISSING_TOTAL",
    );
  }
  const total = parseFloat(String(totalRaw));
  if (isNaN(total)) {
    throw new CfdiParseError(`Total '${String(totalRaw)}' no es un número válido`, "INVALID_TOTAL");
  }

  const complemento = asNode(comprobante.Complemento);
  if (!complemento) {
    throw new CfdiParseError(
      "Nodo cfdi:Complemento no encontrado. El CFDI no está timbrado.",
      "MISSING_COMPLEMENTO",
    );
  }

  const timbre = asNode(complemento.TimbreFiscalDigital);
  if (!timbre) {
    throw new CfdiParseError(
      "Nodo tfd:TimbreFiscalDigital no encontrado en cfdi:Complemento",
      "MISSING_TIMBRE",
    );
  }

  const uuid = attr(timbre, "@_UUID");
  if (!uuid) {
    throw new CfdiParseError(
      "Atributo UUID no encontrado en tfd:TimbreFiscalDigital",
      "MISSING_UUID",
    );
  }

  const uuidNormalized = uuid.toUpperCase().trim();
  if (
    !/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/.test(uuidNormalized)
  ) {
    throw new CfdiParseError(`UUID '${uuid}' no tiene formato UUID válido`, "INVALID_UUID_FORMAT");
  }

  const taxes = extractTaxes(asNode(comprobante.Impuestos));

  const selloRaw = comprobante["@_Sello"] ?? null;
  const sello =
    selloRaw !== null && selloRaw !== undefined && selloRaw !== ""
      ? String(selloRaw).trim()
      : null;

  return {
    version,
    rfcEmisor: rfcEmisor.toUpperCase().trim(),
    rfcReceptor: rfcReceptor ? rfcReceptor.toUpperCase().trim() : null,
    fecha: fechaDate,
    total,
    uuid: uuidNormalized,
    sello,
    selloUltimos8: selloUltimos8FromSello(sello),
    taxes,
  };
}

/**
 * Extracts and normalizes tax breakdowns from cfdi:Impuestos node.
 */
export function extractTaxes(impuestos: XmlNode | undefined): CfdiTaxesBreakdown {
  if (!impuestos) {
    return { totalTrasladados: null, totalRetenidos: null, traslados: [], retenciones: [] };
  }

  const totalTrasladadosRaw = impuestos["@_TotalImpuestosTrasladados"];
  const totalTrasladados =
    totalTrasladadosRaw !== undefined && totalTrasladadosRaw !== null && totalTrasladadosRaw !== ""
      ? parseFloat(String(totalTrasladadosRaw))
      : null;

  const totalRetenidosRaw = impuestos["@_TotalImpuestosRetenidos"];
  const totalRetenidos =
    totalRetenidosRaw !== undefined && totalRetenidosRaw !== null && totalRetenidosRaw !== ""
      ? parseFloat(String(totalRetenidosRaw))
      : null;

  const trasladosNode = asNode(impuestos.Traslados);
  const trasladoRows = (trasladosNode?.Traslado ?? []) as XmlNode[];
  const traslados: CfdiTrasladoBreakdown[] = trasladoRows.map((t) => {
    const codigo = attr(t, "@_Impuesto") ?? "";
    return {
      base: parseFloat(String(t["@_Base"])),
      impuesto: codigo,
      impuestoNombre: IMPUESTO_NOMBRES[codigo] ?? codigo,
      tipoFactor: attr(t, "@_TipoFactor"),
      tasaOCuota: parseFloat(String(t["@_TasaOCuota"])),
      importe: parseFloat(String(t["@_Importe"])),
    };
  });

  const retencionesNode = asNode(impuestos.Retenciones);
  const retRaw = retencionesNode?.Retencion ?? [];
  const retList = (Array.isArray(retRaw) ? retRaw : [retRaw]) as XmlNode[];
  const retenciones: CfdiRetencionBreakdown[] = retList.map((r) => {
    const codigo = attr(r, "@_Impuesto") ?? "";
    const row: CfdiRetencionBreakdown = {
      impuesto: codigo,
      impuestoNombre: IMPUESTO_NOMBRES[codigo] ?? codigo,
      importe: parseFloat(String(r["@_Importe"])),
    };
    if (r["@_Base"] !== undefined && r["@_Base"] !== "") {
      row.base = parseFloat(String(r["@_Base"]));
    }
    if (r["@_TasaOCuota"] !== undefined && r["@_TasaOCuota"] !== "") {
      row.tasaOCuota = parseFloat(String(r["@_TasaOCuota"]));
    }
    return row;
  });

  return { totalTrasladados, totalRetenidos, traslados, retenciones };
}

/** Cuerpo snake_case listo para POST /api/comprobantes/:receipt_id. */
export type ComprobanteRegistroBody = {
  uuid: string;
  fecha_timbrado: string;
  rfc_pac: string;
  version: string;
  serie?: string;
  folio?: string;
  fecha_emision: string;
  tipo_comprobante: string;
  lugar_expedicion: string;
  exportacion: string;
  metodo_pago: string;
  forma_pago: string;
  moneda: string;
  tipo_cambio: number;
  subtotal: number;
  descuento: number;
  iva: number;
  impuestos: ReturnType<typeof buildImpuestosFromTaxesBreakdown>;
  total_retenidos: number;
  total: number;
  rfc_emisor: string;
  nombre_emisor: string;
  regimen_fiscal_emisor: string;
  rfc_receptor: string;
  nombre_receptor: string;
  domicilio_fiscal_receptor: string;
  regimen_fiscal_receptor: string;
  uso_cfdi: string;
  sello_emisor?: string;
};

/**
 * Construye el cuerpo JSON esperado por POST /api/comprobantes/:receipt_id (validateCfdi + insertarCfdi)
 * a partir del XML timbrado. El PDF no interviene (solo respaldo).
 *
 * @throws {CfdiParseError}
 */
export function buildComprobanteRegistroBodyFromXml(
  xmlString: string,
): ComprobanteRegistroBody {
  if (!xmlString || typeof xmlString !== "string" || !xmlString.trim()) {
    throw new CfdiParseError("El contenido XML está vacío", "EMPTY_XML");
  }

  let parsed: unknown;
  try {
    parsed = parser.parse(xmlString);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new CfdiParseError(`XML malformado: ${message}`, "INVALID_XML");
  }

  const comprobante = getComprobanteRoot(parsed);
  if (!comprobante) {
    throw new CfdiParseError("Nodo Comprobante no encontrado", "MISSING_COMPROBANTE");
  }

  const version = attr(comprobante, "@_Version");
  if (!version || !SUPPORTED_VERSIONS.includes(version as (typeof SUPPORTED_VERSIONS)[number])) {
    throw new CfdiParseError(
      `Versión CFDI no soportada para registro: ${version}`,
      "UNSUPPORTED_VERSION",
    );
  }

  const emisor = asNode(comprobante.Emisor);
  const receptor = asNode(comprobante.Receptor);
  if (!attr(emisor, "@_Rfc") || !attr(receptor, "@_Rfc")) {
    throw new CfdiParseError("Emisor o Receptor sin RFC", "MISSING_RFC");
  }

  const complemento = asNode(comprobante.Complemento);
  const timbre = asNode(complemento?.TimbreFiscalDigital);
  if (
    !attr(timbre, "@_UUID") ||
    !attr(timbre, "@_FechaTimbrado") ||
    !attr(timbre, "@_RfcProvCertif")
  ) {
    throw new CfdiParseError(
      "TimbreFiscalDigital incompleto (UUID, FechaTimbrado o RfcProvCertif)",
      "MISSING_TIMBRE_FIELDS",
    );
  }

  const uuid = String(attr(timbre, "@_UUID")).toUpperCase().trim();
  const fechaTimbrado = String(attr(timbre, "@_FechaTimbrado")).trim();
  const rfcPac = String(attr(timbre, "@_RfcProvCertif")).trim().toUpperCase();

  const fechaEmision = attr(comprobante, "@_Fecha");
  if (!fechaEmision) {
    throw new CfdiParseError("Falta Fecha del comprobante", "MISSING_FECHA");
  }

  const tipoComprobante = attr(comprobante, "@_TipoDeComprobante");
  if (!tipoComprobante) {
    throw new CfdiParseError("Falta TipoDeComprobante", "MISSING_TIPO_COMPROBANTE");
  }

  const lugarExp = attr(comprobante, "@_LugarExpedicion");
  if (!lugarExp || !/^\d{5}$/.test(String(lugarExp).trim())) {
    throw new CfdiParseError(
      "LugarExpedicion debe ser CP de 5 dígitos",
      "INVALID_LUGAR_EXPEDICION",
    );
  }

  const metodoPago = attr(comprobante, "@_MetodoPago");
  if (!metodoPago || !["PUE", "PPD"].includes(String(metodoPago))) {
    throw new CfdiParseError("MetodoPago debe ser PUE o PPD", "INVALID_METODO_PAGO");
  }

  const formaPago = attr(comprobante, "@_FormaPago");
  if (!formaPago || String(formaPago).trim().length !== 2) {
    throw new CfdiParseError("FormaPago debe ser código de 2 caracteres", "INVALID_FORMA_PAGO");
  }

  const moneda = (attr(comprobante, "@_Moneda") || "MXN").toString().trim().toUpperCase();
  if (moneda.length !== 3) {
    throw new CfdiParseError("Moneda inválida", "INVALID_MONEDA");
  }

  const subtotal = parseFloat(String(comprobante["@_SubTotal"]));
  const total = parseFloat(String(comprobante["@_Total"]));
  if (Number.isNaN(subtotal) || Number.isNaN(total)) {
    throw new CfdiParseError("SubTotal o Total inválidos", "INVALID_TOTALES");
  }

  const descRaw = comprobante["@_Descuento"];
  const descuento =
    descRaw !== undefined && descRaw !== "" ? parseFloat(String(descRaw)) : 0;
  const tipoCambioRaw = comprobante["@_TipoCambio"];
  const tipoCambio =
    tipoCambioRaw !== undefined && tipoCambioRaw !== ""
      ? parseFloat(String(tipoCambioRaw))
      : 1.0;

  const nombreEmisor = String(attr(emisor, "@_Nombre") || "").trim();
  const nombreReceptor = String(attr(receptor, "@_Nombre") || "").trim();
  if (!nombreEmisor || !nombreReceptor) {
    throw new CfdiParseError("Nombre emisor o receptor vacío", "MISSING_NOMBRE");
  }

  const regFisEm = String(attr(emisor, "@_RegimenFiscal") || "").trim();
  const regFisRec = String(attr(receptor, "@_RegimenFiscalReceptor") || "").trim();
  if (regFisEm.length !== 3 || regFisRec.length !== 3) {
    throw new CfdiParseError(
      "Régimen fiscal emisor/receptor debe ser 3 dígitos",
      "INVALID_REGIMEN",
    );
  }

  const domFiscal = String(attr(receptor, "@_DomicilioFiscalReceptor") || "").trim();
  if (!/^\d{5}$/.test(domFiscal)) {
    throw new CfdiParseError(
      "DomicilioFiscalReceptor debe ser CP de 5 dígitos",
      "INVALID_DOM_FISCAL",
    );
  }

  const usoCfdi = String(attr(receptor, "@_UsoCFDI") || "").trim();
  if (usoCfdi.length < 2 || usoCfdi.length > 4) {
    throw new CfdiParseError("UsoCFDI inválido", "INVALID_USO_CFDI");
  }

  const taxes = extractTaxes(asNode(comprobante.Impuestos));
  const impuestos = buildImpuestosFromTaxesBreakdown(taxes, { usoCfdi });
  const iva = sumIvaTrasladadoFromImpuestos(impuestos);
  const totalRetenidos =
    taxes.totalRetenidos != null && !Number.isNaN(taxes.totalRetenidos)
      ? taxes.totalRetenidos
      : sumRetencionesFromImpuestos(impuestos);

  const selloRaw = comprobante["@_Sello"] ?? null;
  const selloEmisor =
    selloRaw !== null && selloRaw !== undefined && String(selloRaw).trim().length >= 8
      ? String(selloRaw).trim()
      : undefined;

  const exportacion = (attr(comprobante, "@_Exportacion") || "01").toString().trim();
  const serieRaw = comprobante["@_Serie"];
  const serie =
    serieRaw !== null && serieRaw !== undefined ? String(serieRaw).trim() : undefined;
  const folioRaw = comprobante["@_Folio"];
  const folio =
    folioRaw !== null && folioRaw !== undefined ? String(folioRaw).trim() : undefined;

  const fechaEmisionIso = new Date(fechaEmision).toISOString();
  let fechaTimbradoIso: string;
  try {
    fechaTimbradoIso = new Date(fechaTimbrado).toISOString();
  } catch {
    throw new CfdiParseError("FechaTimbrado inválida", "INVALID_FECHA_TIMBRADO");
  }

  const body: ComprobanteRegistroBody = {
    uuid,
    fecha_timbrado: fechaTimbradoIso,
    rfc_pac: rfcPac,
    version: String(version),
    serie: serie || undefined,
    folio: folio || undefined,
    fecha_emision: fechaEmisionIso,
    tipo_comprobante: String(tipoComprobante).trim(),
    lugar_expedicion: String(lugarExp).trim(),
    exportacion,
    metodo_pago: String(metodoPago).trim(),
    forma_pago: String(formaPago).trim(),
    moneda,
    tipo_cambio: tipoCambio,
    subtotal,
    descuento: Number.isNaN(descuento) ? 0 : descuento,
    iva,
    impuestos,
    total_retenidos: totalRetenidos,
    total,
    rfc_emisor: String(attr(emisor, "@_Rfc")).toUpperCase().trim(),
    nombre_emisor: nombreEmisor,
    regimen_fiscal_emisor: regFisEm,
    rfc_receptor: String(attr(receptor, "@_Rfc")).toUpperCase().trim(),
    nombre_receptor: nombreReceptor,
    domicilio_fiscal_receptor: domFiscal,
    regimen_fiscal_receptor: regFisRec,
    uso_cfdi: usoCfdi,
  };

  if (selloEmisor) {
    body.sello_emisor = selloEmisor;
  }

  return body;
}
