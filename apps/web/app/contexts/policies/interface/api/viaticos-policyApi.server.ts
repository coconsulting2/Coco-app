/**
 * @module viaticos-policyApi.server
 * @description Dispatcher /api/viaticos-policy/* — preservado para
 * compatibilidad con el contrato OpenAPI. Resuelve el organizationId desde la
 * sesión (paridad con el legacy `resolveOrgId`).
 */
import { jsonOk, jsonError, jsonFromError } from "~/platform/http/responses";
import {
  requirePermissions,
  runInTenant,
  type ResolvedSession,
} from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";
import {
  getViaticosPolicy,
  setViaticosPolicy,
} from "~/contexts/policies/application/viaticasPolicyService.js";
import type { ViaticosPolicyPayload } from "~/contexts/policies/domain/types";

type DispatchArgs = { request: Request; subpath: string };
type DispatchCtx = { session: ResolvedSession; body: Record<string, unknown> | null };
type Handler = (m: RegExpMatchArray, ctx: DispatchCtx) => Promise<unknown>;

function toPayload(body: Record<string, unknown> | null): ViaticosPolicyPayload {
  const b = body ?? {};
  return {
    maxHotel: Number(b.max_hotel ?? b.maxHotel),
    maxMeal: Number(b.max_meal ?? b.maxMeal),
    currency: typeof b.currency === "string" ? b.currency : undefined,
    active: typeof b.active === "boolean" ? b.active : undefined,
  };
}

const ROUTES: Array<{ method: string; pattern: RegExp; handler: Handler }> = [
  {
    method: "GET",
    pattern: /^$/,
    handler: async (_m, { session }) => getViaticosPolicy(session.organizationId),
  },
  {
    method: "PUT",
    pattern: /^$/,
    handler: async (_m, { session, body }) =>
      setViaticosPolicy(session.organizationId, toPayload(body)),
  },
];

export async function dispatchViaticosPolicyApi({
  request,
  subpath,
}: DispatchArgs): Promise<Response> {
  const method = request.method.toUpperCase();
  const path = subpath.split("?")[0] ?? "";

  try {
    const session = await requirePermissions(request, "policy:read");
    for (const r of ROUTES) {
      if (r.method !== method) continue;
      const m = path.match(r.pattern);
      if (!m) continue;
      if (method !== "GET" && method !== "HEAD") {
        await assertCsrf(request);
      }
      const body = method !== "GET" && method !== "HEAD" ? await readJson(request) : null;
      const result = await runInTenant(session, async () => r.handler(m, { session, body }));
      return jsonOk(result ?? { ok: true });
    }
    return jsonError(
      404,
      `Unknown viaticos-policy endpoint: ${method} ${path}`,
      "UNKNOWN_ENDPOINT",
    );
  } catch (err) {
    return jsonFromError(err);
  }
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const text = await request.text();
    if (!text) return null;
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}
