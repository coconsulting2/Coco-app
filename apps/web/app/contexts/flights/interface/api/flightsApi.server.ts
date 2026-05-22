// @ts-nocheck — dispatcher legacy bound to pre-hex services; M9 follow-up
/**
 * @module flightsApi.server
 * @description Dispatcher /api/flights/*. Réplica del controller legacy.
 * Cada loader/action de RR v7 in-app debería preferir DI directo a los
 * use-cases del slice; este resource route se conserva para compatibilidad
 * con componentes legacy y contrato OpenAPI.
 */
import { jsonOk, jsonError, jsonFromError } from "~/platform/http/responses";
import { requireSession, requirePermissions, runInTenant } from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";

import * as flightProvider from "~/contexts/flights/infrastructure/flightProvider.js";

type DispatchArgs = { request: Request; subpath: string };

const ROUTES: Array<{ method: string; pattern: RegExp; perm: string | null; handler: (m: RegExpMatchArray, ctx: any) => Promise<unknown> | unknown }> = [
  { method: "POST", pattern: /^search$/, perm: null, handler: async (m, { session, body, url }) => flightProvider.default?.search?.(body) ?? flightProvider.search?.(body) },
  { method: "GET", pattern: /^quote\/([\w-]+)$/, perm: null, handler: async (m, { session, body, url }) => flightProvider.default?.quote?.(m[1]) ?? flightProvider.quote?.(m[1]) },
];

export async function dispatchFlightsApi({ request, subpath }: DispatchArgs): Promise<Response> {
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
    return jsonError(404, `Unknown flights endpoint: ${method} ${path}`, "UNKNOWN_ENDPOINT");
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
