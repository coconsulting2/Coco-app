/**
 * @module solicitud-workflowApi.server
 * @description Dispatcher /api/solicitudes/*. Réplica del controller legacy.
 * Cada loader/action de RR v7 in-app debería preferir DI directo a los
 * use-cases del slice; este resource route se conserva para compatibilidad
 * con componentes legacy y contrato OpenAPI.
 */
import { jsonOk, jsonError, jsonFromError } from "~/platform/http/responses";
import { requireSession, requirePermissions, runInTenant } from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as authorizerService from "~/contexts/approvals/application/authorizerService.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import Authorizer from "~/contexts/approvals/infrastructure/authorizerModel.js";

type DispatchArgs = { request: Request; subpath: string };

const ROUTES: Array<{ method: string; pattern: RegExp; perm: string | null; handler: (m: RegExpMatchArray, ctx: any) => Promise<unknown> | unknown }> = [
  { method: "POST", pattern: /^(\d+)\/aprobar$/, perm: "travel_request:authorize", handler: async (m, { session, body, url }) => authorizerService.authorizeTravelRequest(Number(m[1]), session.user.user_id, body) },
  { method: "POST", pattern: /^(\d+)\/rechazar$/, perm: "travel_request:authorize", handler: async (m, { session, body, url }) => authorizerService.rejectTravelRequest(Number(m[1]), session.user.user_id, body) },
  { method: "POST", pattern: /^(\d+)\/reasignar$/, perm: "travel_request:authorize", handler: async (m, { session, body, url }) => authorizerService.reassignTravelRequest?.(Number(m[1]), Number(body?.userId ?? body?.user_id), session.user.user_id) },
  { method: "GET", pattern: /^(\d+)\/historial$/, perm: "travel_request:authorize", handler: async (m, { session, body, url }) => Authorizer.getHistorial?.(Number(m[1])) },
];

export async function dispatchSolicitudWorkflowApi({ request, subpath }: DispatchArgs): Promise<Response> {
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
    return jsonError(404, `Unknown solicitud-workflow endpoint: ${method} ${path}`, "UNKNOWN_ENDPOINT");
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
