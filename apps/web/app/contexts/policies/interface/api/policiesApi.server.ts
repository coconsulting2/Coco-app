/**
 * @module policiesApi.server
 * @description Dispatcher /api/policies/* — preservado para compatibilidad con
 * el contrato OpenAPI. Para flujos in-app nuevos, prefiere actions/loaders
 * directos (DI) — ver routes/_app/admin/expense-policies.tsx.
 */
import { jsonOk, jsonError, jsonFromError } from "~/platform/http/responses";
import {
  requirePermissions,
  runInTenant,
  type ResolvedSession,
} from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";
import {
  listPolicies,
  getPolicy,
  createPolicy,
  updatePolicy,
  deactivatePolicy,
} from "~/contexts/policies/application/policyService.js";
import {
  checkReceiptBeforeSubmit,
  type CheckReceiptInput,
} from "~/contexts/policies/application/policyAlertService.js";
import type { PolicyPayload } from "~/contexts/policies/domain/types";

type DispatchArgs = { request: Request; subpath: string };
type DispatchCtx = { session: ResolvedSession; body: Record<string, unknown> | null };
type Handler = (m: RegExpMatchArray, ctx: DispatchCtx) => Promise<unknown>;

const ROUTES: Array<{ method: string; pattern: RegExp; handler: Handler }> = [
  {
    method: "GET",
    pattern: /^$/,
    handler: async (_m, { session }) => ({
      policies: await listPolicies(session.organizationId),
    }),
  },
  {
    method: "GET",
    pattern: /^(\d+)$/,
    handler: async (m, { session }) => getPolicy(Number(m[1]), session.organizationId),
  },
  {
    method: "POST",
    pattern: /^$/,
    handler: async (_m, { session, body }) =>
      createPolicy(session.organizationId, (body ?? {}) as PolicyPayload),
  },
  {
    method: "PUT",
    pattern: /^(\d+)$/,
    handler: async (m, { session, body }) =>
      updatePolicy(Number(m[1]), session.organizationId, (body ?? {}) as PolicyPayload),
  },
  {
    method: "DELETE",
    pattern: /^(\d+)$/,
    handler: async (m, { session }) =>
      deactivatePolicy(Number(m[1]), session.organizationId),
  },
  {
    method: "POST",
    pattern: /^preview$/,
    handler: async (_m, { body }) =>
      checkReceiptBeforeSubmit((body ?? {}) as unknown as CheckReceiptInput),
  },
];

export async function dispatchPoliciesApi({ request, subpath }: DispatchArgs): Promise<Response> {
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
    return jsonError(404, `Unknown policies endpoint: ${method} ${path}`, "UNKNOWN_ENDPOINT");
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
