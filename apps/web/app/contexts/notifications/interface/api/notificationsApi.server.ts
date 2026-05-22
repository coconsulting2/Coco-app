/**
 * @module notificationsApi.server
 * @description Dispatcher /api/notifications/* — preservado para compatibilidad
 * con componentes legacy que lo consumen vía apiClient + contrato OpenAPI.
 * Para flujos in-app nuevos, prefiere actions/loaders directos (DI).
 */
import { jsonOk, jsonError, jsonFromError } from "~/platform/http/responses";
import { requireSession, runInTenant } from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — JS module
import * as notificationService from "~/contexts/notifications/application/notificationService.js";

type DispatchArgs = { request: Request; subpath: string };

const ROUTES: Array<{ method: string; pattern: RegExp; handler: (m: RegExpMatchArray, ctx: any) => Promise<unknown> }> = [
  { method: "GET", pattern: /^$/, handler: async (m, { session, body }) => notificationService.listForUser(session.user.user_id) },
  { method: "POST", pattern: /^subscribe$/, handler: async (m, { session, body }) => notificationService.subscribePush(session.user.user_id, body) },
];

export async function dispatchNotificationsApi({ request, subpath }: DispatchArgs): Promise<Response> {
  const method = request.method.toUpperCase();
  const path = subpath.split("?")[0] ?? "";

  try {
    const session = await requireSession(request);
    for (const r of ROUTES) {
      if (r.method !== method) continue;
      const m = path.match(r.pattern);
      if (!m) continue;
      if (method !== "GET" && method !== "HEAD") {
        await assertCsrf(request);
      }
      const body = (method !== "GET" && method !== "HEAD") ? await readJson(request) : null;
      const result = await runInTenant(session, async () =>
        r.handler(m, { session, body }),
      );
      return jsonOk(result ?? { ok: true });
    }
    return jsonError(404, `Unknown notifications endpoint: ${method} ${path}`, "UNKNOWN_ENDPOINT");
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
