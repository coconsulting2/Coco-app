/**
 * @module filesApi.server
 * @description Dispatcher /api/files/*. Réplica del controller legacy.
 * Cada loader/action de RR v7 in-app debería preferir DI directo a los
 * use-cases del slice; este resource route se conserva para compatibilidad
 * con componentes legacy y contrato OpenAPI.
 */
import { jsonOk, jsonError, jsonFromError } from "~/platform/http/responses";
import { requireSession, requirePermissions, runInTenant } from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";
import {
  getReceiptFile,
  getReceiptFilesMetadata,
} from "~/contexts/receipts-cfdi";

type DispatchArgs = { request: Request; subpath: string };

type DispatchCtx = {
  session: Awaited<ReturnType<typeof requireSession>>;
  body: Record<string, unknown> | null;
  url: URL;
};

const ROUTES: Array<{ method: string; pattern: RegExp; perm: string | null; handler: (m: RegExpMatchArray, ctx: DispatchCtx) => Promise<unknown> | unknown }> = [
  { method: "POST", pattern: /^upload-receipt-files\/(\d+)$/, perm: null, handler: async () => ({ status: 410, message: "Endpoint retirado — el upload de comprobantes usa la action RR7 de subir-comprobante.$id (multipart)." }) },
  { method: "GET", pattern: /^receipt-file\/([\w-]+)$/, perm: null, handler: async (m) => getReceiptFile(String(m[1])) },
  { method: "GET", pattern: /^receipt-files\/(\d+)$/, perm: null, handler: async (m) => getReceiptFilesMetadata(Number(m[1])) },
];

export async function dispatchFilesApi({ request, subpath }: DispatchArgs): Promise<Response> {
  const method = request.method.toUpperCase();
  const path = subpath.split("?")[0] ?? "";
  const url = new URL(request.url);

  try {
    for (const r of ROUTES) {
      if (r.method !== method) continue;
      const m = path.match(r.pattern);
      if (!m) continue;
      const session = r.perm
        ? await requirePermissions(request, r.perm)
        : await requireSession(request);
      if (method !== "GET" && method !== "HEAD") {
        await assertCsrf(request);
      }
      const body = (method !== "GET" && method !== "HEAD") ? await readJson(request) : null;
      const result = await runInTenant(session, async () => r.handler(m, { session, body, url }));
      return jsonOk(result ?? { ok: true });
    }
    return jsonError(404, `Unknown files endpoint: ${method} ${path}`, "UNKNOWN_ENDPOINT");
  } catch (err) {
    return jsonFromError(err);
  }
}

async function readJson(request: Request): Promise<any | null> {
  try {
    const text = await request.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}
