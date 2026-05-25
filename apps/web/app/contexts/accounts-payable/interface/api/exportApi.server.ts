/**
 * @module exportApi.server
 * @description Dispatcher /api/export/*. Réplica del controller legacy.
 * Cada loader/action de RR v7 in-app debería preferir DI directo a los
 * use-cases del slice; este resource route se conserva para compatibilidad
 * con componentes legacy y contrato OpenAPI.
 */
import { jsonOk, jsonError, jsonFromError } from "~/platform/http/responses";
import {
  requireSession,
  requirePermissions,
  runInTenant,
  type ResolvedSession,
} from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";

import AccountingExportService from "~/contexts/accounts-payable/application/accountingExportService.js";

type DispatchArgs = { request: Request; subpath: string };

type RequestBody = Record<string, unknown> | null;

type HandlerContext = {
  session: ResolvedSession;
  body: RequestBody;
  url: URL;
};

type RouteDef = {
  method: string;
  pattern: RegExp;
  perm: string | null;
  handler: (m: RegExpMatchArray, ctx: HandlerContext) => Promise<unknown> | unknown;
};

const ROUTES: RouteDef[] = [
  {
    method: "GET",
    pattern: /^contable$/,
    perm: "accounting:export",
    handler: async (_m, { url }) =>
      AccountingExportService.getPolizasInRange(
        new Date(url.searchParams.get("date_from") ?? ""),
        new Date(url.searchParams.get("date_to") ?? new Date().toISOString()),
      ),
  },
];

export async function dispatchExportApi({ request, subpath }: DispatchArgs): Promise<Response> {
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
      const body = method !== "GET" && method !== "HEAD" ? await readJson(request) : null;
      const result = await runInTenant(session, async () => r.handler(m, { session, body, url }));
      if (result instanceof Response) return result;
      return jsonOk(result ?? { ok: true });
    }
    return jsonError(404, `Unknown export endpoint: ${method} ${path}`, "UNKNOWN_ENDPOINT");
  } catch (err) {
    return jsonFromError(err);
  }
}

async function readJson(request: Request): Promise<RequestBody> {
  try {
    const text = await request.text();
    if (!text) return null;
    return JSON.parse(text) as RequestBody;
  } catch {
    return null;
  }
}
