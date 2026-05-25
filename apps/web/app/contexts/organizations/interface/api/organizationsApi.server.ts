/**
 * @module organizationsApi.server
 * @description Dispatcher /api/organizations/* — preservado para compatibilidad
 * con componentes legacy que lo consumen vía apiClient + contrato OpenAPI.
 * Para flujos in-app nuevos, prefiere actions/loaders directos (DI).
 */
import { jsonOk, jsonError, jsonFromError } from "~/platform/http/responses";
import { requirePermissions, runInTenant } from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";

import * as organizationService from "~/contexts/organizations/application/organizationService.js";
import type {
  CreateOrganizationInput,
  UpdateOrganizationPatch,
} from "~/contexts/organizations/application/organizationService.js";

type DispatchArgs = { request: Request; subpath: string };

type HandlerCtx = { body: unknown };

type RouteEntry = {
  method: string;
  pattern: RegExp;
  handler: (m: RegExpMatchArray, ctx: HandlerCtx) => Promise<unknown>;
};

const ROUTES: RouteEntry[] = [
  { method: "GET", pattern: /^$/, handler: async () => organizationService.listOrganizations() },
  { method: "GET", pattern: /^(\d+)$/, handler: async (m) => organizationService.getOrganization(BigInt(m[1]!)) },
  {
    method: "POST",
    pattern: /^$/,
    handler: async (_m, { body }) =>
      organizationService.createOrganization(body as CreateOrganizationInput),
  },
  {
    method: "PUT",
    pattern: /^(\d+)$/,
    handler: async (m, { body }) =>
      organizationService.updateOrganization(
        BigInt(m[1]!),
        body as UpdateOrganizationPatch,
      ),
  },
];

export async function dispatchOrganizationsApi({ request, subpath }: DispatchArgs): Promise<Response> {
  const method = request.method.toUpperCase();
  const path = subpath.split("?")[0] ?? "";

  try {
    const session = await requirePermissions(request, "organization:read");
    for (const r of ROUTES) {
      if (r.method !== method) continue;
      const m = path.match(r.pattern);
      if (!m) continue;
      if (method !== "GET" && method !== "HEAD") {
        await assertCsrf(request);
      }
      const body = (method !== "GET" && method !== "HEAD") ? await readJson(request) : null;
      const result = await runInTenant(session, async () =>
        r.handler(m, { body }),
      );
      return jsonOk(result ?? { ok: true });
    }
    return jsonError(404, `Unknown organizations endpoint: ${method} ${path}`, "UNKNOWN_ENDPOINT");
  } catch (err) {
    return jsonFromError(err);
  }
}

async function readJson(request: Request): Promise<unknown> {
  try {
    const text = await request.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}
