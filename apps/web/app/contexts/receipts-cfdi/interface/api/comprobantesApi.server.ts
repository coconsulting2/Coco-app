/**
 * @module comprobantesApi.server
 * @description Dispatcher /api/comprobantes/* — contrato público (OpenAPI M1).
 * Invoca los use-cases hexagonales del slice (register nacional/internacional,
 * preview parse-xml, validación SAT). Para flujos in-app nuevos prefiere
 * actions/loaders directos (DI). Tipado proper, sin supresiones.
 */
import { jsonOk, jsonError, jsonFromError } from "~/platform/http/responses";
import { requirePermissions, runInTenant } from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";
import {
  registerReceiptCfdi,
  registerInternationalReceipt,
  getReceiptSatValidation,
  type RegisterReceiptCfdiInput,
  type RegisterInternationalReceiptInput,
} from "~/contexts/receipts-cfdi";
import { buildComprobanteRegistroBodyFromXml } from "~/contexts/receipts-cfdi/application/cfdiParserService.js";

type DispatchArgs = { request: Request; subpath: string };

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const text = await request.text();
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function dispatchComprobantesApi({
  request,
  subpath,
}: DispatchArgs): Promise<Response> {
  const method = request.method.toUpperCase();
  const path = subpath.split("?")[0] ?? "";

  try {
    const session = await requirePermissions(request, "expense:submit");

    // POST /parse-xml — preview RFC/UUID/monto desde el XML (no persiste).
    if (method === "POST" && path === "parse-xml") {
      await assertCsrf(request);
      const form = await request.formData();
      const xml = form.get("xml");
      if (!(xml instanceof File)) {
        return jsonError(400, "Falta el archivo XML", "MISSING_XML");
      }
      const xmlText = await xml.text();
      return jsonOk(buildComprobanteRegistroBodyFromXml(xmlText));
    }

    // GET /:receiptId/validacion-sat — última validación SAT del recibo.
    const satMatch = path.match(/^(\d+)\/validacion-sat$/);
    if (method === "GET" && satMatch) {
      const result = await runInTenant(session, async () =>
        getReceiptSatValidation(Number(satMatch[1])),
      );
      return jsonOk(result ?? null);
    }

    // POST /:receiptId — registra comprobante (internacional o CFDI nacional).
    const registerMatch = path.match(/^(\d+)$/);
    if (method === "POST" && registerMatch) {
      await assertCsrf(request);
      const receiptId = Number(registerMatch[1]);
      const body = await readJson(request);
      const result = await runInTenant(session, async () => {
        const rawIntl = body.is_international;
        const isInternational =
          rawIntl === true || rawIntl === "true" || rawIntl === 1 || rawIntl === "1";
        if (isInternational) {
          return registerInternationalReceipt({
            receiptId,
            body: body as RegisterInternationalReceiptInput["body"],
          });
        }
        return registerReceiptCfdi({
          receiptId,
          cfdiData: body as RegisterReceiptCfdiInput["cfdiData"],
        });
      });
      return jsonOk(result);
    }

    return jsonError(404, `Unknown comprobantes endpoint: ${method} ${path}`, "UNKNOWN_ENDPOINT");
  } catch (err) {
    return jsonFromError(err);
  }
}
