/**
 * @module cfdiImpuestos
 * @description Normalización de traslados/retenciones CFDI (c_Impuesto SAT) para persistencia y pólizas GV.
 *
 * Fórmula SAT (CFDI40119): Total = SubTotal − Descuento + ΣTraslados − ΣRetenciones
 * Tolerancia de cuadre: 0.01 MXN (mismo criterio que el PAC al timbrar).
 *
 * Códigos SAT (c_Impuesto): 001 ISR | 002 IVA | 003 IEPS
 */
import { GL_ACCOUNTS } from "@coco/shared-config/accountingCatalogs";

/** Tipo de impuesto CFDI: trasladado al receptor o retenido. */
export type ImpuestoTipo = "traslado" | "retencion";

/** Línea de impuesto normalizada para persistencia y pólizas GV. */
export type CfdiImpuestoLine = {
  /** "001" ISR | "002" IVA | "003" IEPS */
  codigo: string;
  tipo: ImpuestoTipo;
  base?: number;
  tasa?: number;
  importe: number;
  /** Solo traslado IVA (002) cuando aplica. */
  acreditable?: boolean;
  /** Retención inferida sin desglose ISR/IVA. */
  legacyAggregated?: boolean;
};

/** Traslado tal como lo extrae el parser CFDI (`extractTaxes`). */
export type CfdiTrasladoBreakdown = {
  base?: number;
  impuesto?: string;
  impuestoNombre?: string;
  tipoFactor?: string;
  tasaOCuota?: number;
  importe?: number;
};

/** Retención tal como la extrae el parser CFDI (`extractTaxes`). */
export type CfdiRetencionBreakdown = {
  impuesto?: string;
  impuestoNombre?: string;
  importe?: number;
  base?: number;
  tasaOCuota?: number;
};

/** Desglose de impuestos producido por el parser CFDI. */
export type CfdiTaxesBreakdown = {
  totalTrasladados?: number | null;
  totalRetenidos?: number | null;
  traslados?: CfdiTrasladoBreakdown[];
  retenciones?: CfdiRetencionBreakdown[];
};

/** Comprobante mínimo para resolver impuestos / totales / base de gasto. */
export type ComprobanteImpuestosInput = {
  subtotal?: number;
  descuento?: number;
  iva?: number;
  total?: number;
  impuestos?: CfdiImpuestoLine[] | unknown;
  totalRetenidos?: number;
  usoCfdi?: string;
};

/** Cuenta GL resuelta del catálogo extendido (RF-74). */
export type GlCatalogResolved = {
  anticipo: string;
  cxp: string;
  gasto: string;
  iva: string;
  retencionIsr: string;
  retencionIva: string;
  ieps: string;
};

/** Fila del chartOfAccounts del que se resuelven las cuentas GL. */
export type ChartOfAccountRow = {
  accountCode: string;
  accountType?: string;
  active?: boolean;
};

/** Centavos: alineado con validación SAT al timbrar. */
export const AMOUNT_EPSILON = 0.01;

/** Importes monetarios MXN (2 decimales). */
export const roundMoney = (n: unknown): number =>
  Math.round((Number(n) || 0) * 100) / 100;

/** Tasas / cuotas (6 decimales, p. ej. 0.160000). */
export const roundRate = (n: unknown): number =>
  Math.round((Number(n) || 0) * 1000000) / 1000000;

/** UsoCFDI donde el IVA trasladado no es acreditable en gastos de viaje. */
const USO_CFDI_IVA_NO_ACREDITABLE = new Set([
  "S01",
  "D01",
  "D02",
  "D03",
  "D04",
  "D05",
  "D06",
  "D07",
  "D08",
  "D09",
  "D10",
]);

/** Normaliza un código de impuesto SAT a 3 dígitos con padding. */
export const normalizeImpuestoCodigo = (
  code: string | number | null | undefined,
): string => {
  const s = String(code ?? "").trim();
  if (/^\d{1,3}$/.test(s)) return s.padStart(3, "0");
  return s;
};

/**
 * IVA trasladado acreditable según UsoCFDI (heurística; reglas LISR adicionales en policy layer).
 */
export function isIvaTrasladoAcreditable(
  usoCfdi: string | null | undefined,
  codigoImpuesto: string | number | null | undefined,
): boolean {
  if (normalizeImpuestoCodigo(codigoImpuesto) !== "002") return false;
  const uso = String(usoCfdi ?? "G03")
    .trim()
    .toUpperCase();
  if (USO_CFDI_IVA_NO_ACREDITABLE.has(uso)) return false;
  return true;
}

/** Construye líneas de impuesto normalizadas a partir del desglose del parser. */
export function buildImpuestosFromTaxesBreakdown(
  taxes: CfdiTaxesBreakdown | null | undefined,
  options: { usoCfdi?: string } = {},
): CfdiImpuestoLine[] {
  const usoCfdi = options.usoCfdi;
  const out: CfdiImpuestoLine[] = [];

  for (const t of taxes?.traslados ?? []) {
    const codigo = normalizeImpuestoCodigo(t.impuesto);
    const importeRaw = Number(t.importe);
    if (!Number.isFinite(importeRaw)) continue;
    const importe = roundMoney(importeRaw);
    const line: CfdiImpuestoLine = {
      codigo,
      tipo: "traslado",
      importe,
    };
    if (Number.isFinite(t.base)) line.base = roundMoney(t.base);
    if (Number.isFinite(t.tasaOCuota)) line.tasa = roundRate(t.tasaOCuota);
    if (codigo === "002") line.acreditable = isIvaTrasladoAcreditable(usoCfdi, codigo);
    if (codigo === "003") line.acreditable = false;
    out.push(line);
  }

  for (const r of taxes?.retenciones ?? []) {
    const codigo = normalizeImpuestoCodigo(r.impuesto);
    const importeRaw = Number(r.importe);
    if (!Number.isFinite(importeRaw)) continue;
    const line: CfdiImpuestoLine = {
      codigo,
      tipo: "retencion",
      importe: roundMoney(importeRaw),
    };
    if (Number.isFinite(r.base)) line.base = roundMoney(r.base);
    if (Number.isFinite(r.tasaOCuota)) line.tasa = roundRate(r.tasaOCuota);
    out.push(line);
  }

  return out;
}

/** Suma el IVA trasladado (código 002) de las líneas de impuesto. */
export function sumIvaTrasladadoFromImpuestos(
  impuestos: CfdiImpuestoLine[] | null | undefined,
): number {
  return roundMoney(
    (impuestos || [])
      .filter((i) => i.tipo === "traslado" && normalizeImpuestoCodigo(i.codigo) === "002")
      .reduce((s, i) => s + Number(i.importe || 0), 0),
  );
}

/** Suma todas las retenciones de las líneas de impuesto. */
export function sumRetencionesFromImpuestos(
  impuestos: CfdiImpuestoLine[] | null | undefined,
): number {
  return roundMoney(
    (impuestos || [])
      .filter((i) => i.tipo === "retencion")
      .reduce((s, i) => s + Number(i.importe || 0), 0),
  );
}

/** True si alguna línea fue inferida sin desglose (bloquea export hasta re-registrar). */
export function impuestosNeedManualReview(
  impuestos: CfdiImpuestoLine[] | null | undefined,
): boolean {
  return (impuestos || []).some((i) => i.legacyAggregated === true);
}

/** Resuelve las líneas de impuesto desde el comprobante (desglose o inferencia legacy). */
export function resolveImpuestosFromComprobante(
  cfdi: ComprobanteImpuestosInput | null | undefined,
): CfdiImpuestoLine[] {
  if (Array.isArray(cfdi?.impuestos) && cfdi.impuestos.length > 0) {
    return (cfdi.impuestos as CfdiImpuestoLine[]).map((row) => ({
      codigo: normalizeImpuestoCodigo(row.codigo),
      tipo: row.tipo === "retencion" ? "retencion" : "traslado",
      base: row.base !== undefined && row.base !== null ? roundMoney(row.base) : undefined,
      tasa: row.tasa !== undefined && row.tasa !== null ? roundRate(row.tasa) : undefined,
      importe: roundMoney(row.importe),
      acreditable: row.acreditable,
      legacyAggregated: row.legacyAggregated === true,
    }));
  }

  const usoCfdi = cfdi?.usoCfdi;
  const legacy: CfdiImpuestoLine[] = [];
  const iva = roundMoney(cfdi?.iva ?? 0);
  if (iva > 0) {
    legacy.push({
      codigo: "002",
      tipo: "traslado",
      importe: iva,
      acreditable: isIvaTrasladoAcreditable(usoCfdi, "002"),
    });
  }

  // No asignar total_retenidos agregado a IVA (002): rompe ISR+IVA en póliza.
  return inferRetencionesFromTotalsGap(cfdi, legacy);
}

/**
 * Infiere retención agregada solo si falta desglose; marca legacyAggregated para bloquear export hasta re-registrar XML.
 */
function inferRetencionesFromTotalsGap(
  cfdi: ComprobanteImpuestosInput | null | undefined,
  impuestos: CfdiImpuestoLine[],
): CfdiImpuestoLine[] {
  if (impuestos.some((i) => i.tipo === "retencion")) return impuestos;

  const subtotal = roundMoney(cfdi?.subtotal ?? 0);
  const descuento = roundMoney(cfdi?.descuento ?? 0);
  const traslados = roundMoney(
    impuestos.filter((i) => i.tipo === "traslado").reduce((s, i) => s + i.importe, 0),
  );
  const total = roundMoney(cfdi?.total ?? 0);
  const gap = roundMoney(subtotal - descuento + traslados - total);

  if (gap > AMOUNT_EPSILON) {
    impuestos.push({
      codigo: "002",
      tipo: "retencion",
      importe: gap,
      legacyAggregated: true,
    });
    console.warn(
      "[cfdiImpuestos] Retenciones sin desglose ISR/IVA; re-registre el XML del comprobante. Monto inferido:",
      gap,
    );
  }
  return impuestos;
}

/**
 * Resuelve cuentas GL: **accountType** (RF-74) tiene prioridad sobre coincidencia por **accountCode**.
 */
export function resolveExtendedGlCatalogFromAccounts(
  accounts: ChartOfAccountRow[] | null | undefined,
): GlCatalogResolved {
  const sliceCode = (s: unknown): string => String(s ?? "").trim().slice(0, 10);
  const list = (accounts || []).filter((a) => a.active !== false);
  const byCode: Record<string, string> = {};
  const byType: Record<string, string> = {};

  for (const a of list) {
    const c = sliceCode(a.accountCode);
    byCode[c] = c;
    const t = String(a.accountType || "").trim();
    if (t) byType[t] = c;
  }

  const pick = (typeKey: string, defaultCode: string): string =>
    byType[typeKey] ?? byCode[defaultCode] ?? defaultCode;

  return {
    anticipo: pick("Anticipo", GL_ACCOUNTS.ANTICIPO),
    cxp: pick("CxpEmpleado", GL_ACCOUNTS.CUENTA_POR_PAGAR_EMPLEADO),
    gasto: pick("GastoViaje", GL_ACCOUNTS.GASTO_DE_VIAJE),
    iva: pick("Iva", GL_ACCOUNTS.IVA_ACREDITABLE),
    retencionIsr: pick("RetencionIsr", GL_ACCOUNTS.RETENCION_ISR),
    retencionIva: pick("RetencionIva", GL_ACCOUNTS.RETENCION_IVA),
    ieps: pick("Ieps", GL_ACCOUNTS.IEPS),
  };
}

/** Resuelve el catálogo GL desde el chartOfAccounts de la organización del request. */
export function resolveExtendedGlCatalog(
  request: { organization?: { chartOfAccounts?: ChartOfAccountRow[] } } | null | undefined,
): GlCatalogResolved {
  return resolveExtendedGlCatalogFromAccounts(request?.organization?.chartOfAccounts);
}

/** Error de exportación contable con código de máquina. */
class ImpuestoExportError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "ImpuestoExportError";
    this.code = code;
  }
}

/**
 * Cuenta GL para póliza GV.
 * @throws {ImpuestoExportError} code UNSUPPORTED_RETENCION_IEPS / UNSUPPORTED_RETENCION
 */
export function glAccountForImpuesto(
  imp: CfdiImpuestoLine,
  gl: GlCatalogResolved,
): string {
  const codigo = normalizeImpuestoCodigo(imp.codigo);
  if (imp.tipo === "retencion") {
    if (codigo === "001") return gl.retencionIsr;
    if (codigo === "002") return gl.retencionIva;
    if (codigo === "003") {
      throw new ImpuestoExportError(
        "Retención IEPS (003) no está soportada en exportación contable por este módulo. Re-clasifique o corrija el CFDI antes de exportarlo.",
        "UNSUPPORTED_RETENCION_IEPS",
      );
    }
    throw new ImpuestoExportError(
      `Retención con código SAT ${codigo} no soportada en exportación contable.`,
      "UNSUPPORTED_RETENCION",
    );
  }
  if (codigo === "003") return gl.ieps;
  if (codigo === "002") {
    if (imp.acreditable === false) return gl.gasto;
    return gl.iva;
  }
  return gl.gasto;
}

/**
 * Valida coherencia SAT: Total = SubTotal − Descuento + ΣTraslados − ΣRetenciones.
 */
export function cfdiTotalsAreCoherent(
  subtotal: number,
  descuento: number | null | undefined,
  impuestos: CfdiImpuestoLine[],
  total: number,
): boolean {
  const traslados = roundMoney(
    impuestos.filter((i) => i.tipo === "traslado").reduce((s, i) => s + i.importe, 0),
  );
  const retenciones = sumRetencionesFromImpuestos(impuestos);
  const expected = roundMoney(
    roundMoney(subtotal) - roundMoney(descuento || 0) + traslados - retenciones,
  );
  return Math.abs(expected - roundMoney(total)) <= AMOUNT_EPSILON;
}

/**
 * Base de gasto para línea Debe: SubTotal − Descuento (base gravable antes de impuestos).
 */
export function resolveGastoBaseFromComprobante(
  cfdi: { subtotal?: number; descuento?: number } | null | undefined,
): number {
  return roundMoney(roundMoney(cfdi?.subtotal ?? 0) - roundMoney(cfdi?.descuento ?? 0));
}
