/**
 * @module @coco/integrations/sat/consulta
 * @description Cliente SOAP para Consulta de Estado de CFDI (SAT).
 * WSDL: https://consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.svc?wsdl
 */
import soap from "soap";

const DEFAULT_WSDL =
  "https://consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.svc?wsdl";
const DEFAULT_TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [1000, 2000, 4000];

export type ConsultaInput = {
  rfcEmisor: string;
  rfcReceptor: string;
  total: number;
  uuid: string;
  selloUltimos8?: string | null;
};

export type ConsultaResult = {
  codigoEstatus: string;
  estado: string;
  esCancelable: string;
  estatusCancelacion: string;
  validacionEFOS: string;
  raw: unknown;
};

export type CfdiRow = {
  sat_codigo_estatus: string;
  sat_estado: string;
  sat_es_cancelable: string | null;
  sat_estatus_cancelacion: string | null;
  sat_validacion_efos: string;
};

/** Arma expresionImpresa para el método Consulta del SAT. */
export function buildExpresionImpresa(input: ConsultaInput): string {
  const tt = Number(input.total).toFixed(2);
  const id = String(input.uuid).toUpperCase().trim();
  let s = `?re=${input.rfcEmisor}&rr=${input.rfcReceptor}&tt=${tt}&id=${id}`;
  if (input.selloUltimos8 && String(input.selloUltimos8).length >= 8) {
    s += `&fe=${String(input.selloUltimos8).slice(-8)}`;
  }
  return s;
}

type RawConsultaBlock = {
  CodigoEstatus?: string;
  codigoEstatus?: string;
  Estado?: string;
  estado?: string;
  EsCancelable?: string;
  esCancelable?: string;
  EstatusCancelacion?: string;
  estatusCancelacion?: string;
  ValidacionEFOS?: string;
  validacionEFOS?: string;
};

export function normalizeConsultaResult(raw: unknown): ConsultaResult {
  const root = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const block = (root.ConsultaResult ??
    root.consultaResult ??
    root.return ??
    root) as RawConsultaBlock;

  const codigoEstatus = String(block.CodigoEstatus ?? block.codigoEstatus ?? "").trim();
  const estado = String(block.Estado ?? block.estado ?? "").trim();
  const esCancelable = String(block.EsCancelable ?? block.esCancelable ?? "").trim();
  const estatusCancelacion = String(
    block.EstatusCancelacion ?? block.estatusCancelacion ?? "",
  ).trim();
  let validacionEFOS = String(block.ValidacionEFOS ?? block.validacionEFOS ?? "").trim();
  if (!validacionEFOS && estado === "Vigente") {
    validacionEFOS = "200";
  }
  return { codigoEstatus, estado, esCancelable, estatusCancelacion, validacionEFOS, raw };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number, label = "SAT_TIMEOUT"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(label)), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

type SoapAsyncClient = soap.Client & {
  ConsultaAsync: (args: { expresionImpresa: string }) => Promise<unknown[]>;
};

/** Una llamada SOAP al SAT (sin reintentos). */
export async function consultarCfdiOnce(input: ConsultaInput): Promise<ConsultaResult> {
  const wsdl = process.env.SAT_WSDL_URL ?? DEFAULT_WSDL;
  const timeoutMs = Number(process.env.SAT_REQUEST_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  const expresionImpresa = buildExpresionImpresa(input);

  const client = (await soap.createClientAsync(wsdl)) as SoapAsyncClient;
  const call = client.ConsultaAsync({ expresionImpresa });
  const result = await withTimeout(call, timeoutMs, "SAT_TIMEOUT");
  const payload = Array.isArray(result) ? result[0] : result;
  return normalizeConsultaResult(payload);
}

/** Consulta con reintentos (backoff 1s, 2s, 4s). */
export async function consultarCfdiWithRetries(input: ConsultaInput): Promise<ConsultaResult> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length + 1; attempt++) {
    try {
      return await consultarCfdiOnce(input);
    } catch (e) {
      lastErr = e;
      if (attempt < RETRY_DELAYS_MS.length) {
        const delay = RETRY_DELAYS_MS[attempt];
        if (delay) await sleep(delay);
      }
    }
  }
  throw lastErr ?? new Error("SAT_UNAVAILABLE");
}

/** Convierte acuse normalizado a campos snake_case para createCfdi / update. */
export function acuseToCfdiRow(acuse: ConsultaResult): CfdiRow {
  return {
    sat_codigo_estatus: acuse.codigoEstatus,
    sat_estado: acuse.estado,
    sat_es_cancelable: acuse.esCancelable || null,
    sat_estatus_cancelacion: acuse.estatusCancelacion || null,
    sat_validacion_efos: acuse.validacionEFOS || "200",
  };
}
