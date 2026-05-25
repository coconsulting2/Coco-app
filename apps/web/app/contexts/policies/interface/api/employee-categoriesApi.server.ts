/**
 * @module employee-categoriesApi.server
 * @description Dispatcher /api/employee-categories/* — preservado para
 * compatibilidad con el contrato OpenAPI. Para flujos in-app nuevos, prefiere
 * actions/loaders directos (DI) — ver routes/_app/admin/employee-categories.tsx.
 */
import { jsonOk, jsonError, jsonFromError } from "~/platform/http/responses";
import {
  requirePermissions,
  runInTenant,
  type ResolvedSession,
} from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";
import {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deactivateCategory,
} from "~/contexts/policies/application/employeeCategoryService.js";
import type { CategoryPayload } from "~/contexts/policies/domain/types";

type DispatchArgs = { request: Request; subpath: string };
type DispatchCtx = { session: ResolvedSession; body: Record<string, unknown> | null };
type Handler = (m: RegExpMatchArray, ctx: DispatchCtx) => Promise<unknown>;

const ROUTES: Array<{ method: string; pattern: RegExp; handler: Handler }> = [
  {
    method: "GET",
    pattern: /^$/,
    handler: async (_m, { session }) => ({
      categories: await listCategories(session.organizationId),
    }),
  },
  {
    method: "GET",
    pattern: /^(\d+)$/,
    handler: async (m, { session }) => getCategory(Number(m[1]), session.organizationId),
  },
  {
    method: "POST",
    pattern: /^$/,
    handler: async (_m, { session, body }) =>
      createCategory(session.organizationId, (body ?? {}) as CategoryPayload),
  },
  {
    method: "PUT",
    pattern: /^(\d+)$/,
    handler: async (m, { session, body }) =>
      updateCategory(Number(m[1]), session.organizationId, (body ?? {}) as CategoryPayload),
  },
  {
    method: "DELETE",
    pattern: /^(\d+)$/,
    handler: async (m, { session }) =>
      deactivateCategory(Number(m[1]), session.organizationId),
  },
];

export async function dispatchEmployeeCategoriesApi({
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
      `Unknown employee-categories endpoint: ${method} ${path}`,
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
