/**
 * @module onboarding-importApi.server
 * @description Dispatcher /api/onboarding/import/*. Réplica del controller legacy.
 * Cada loader/action de RR v7 in-app debería preferir DI directo a los
 * use-cases del slice; este resource route se conserva para compatibilidad
 * con componentes legacy y contrato OpenAPI.
 */
import { jsonOk, jsonError, jsonFromError } from "~/platform/http/responses";
import { requireSession, requirePermissions, runInTenant } from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as onboardingImportService from "~/contexts/onboarding/application/onboardingImportService.js";

type DispatchArgs = { request: Request; subpath: string };

const ROUTES: Array<{ method: string; pattern: RegExp; perm: string | null; handler: (m: RegExpMatchArray, ctx: any) => Promise<unknown> | unknown }> = [
  { method: "POST", pattern: /^users\/json$/, perm: "user:create", handler: async (m, { session, body, url }) => onboardingImportService.previewImport({ strategyLabel: 'JSON', payload: body, actingUserId: session.user.user_id }) },
  { method: "POST", pattern: /^users\/csv$/, perm: "user:create", handler: async (_m, _ctx) => ({ status: 501, message: "CSV upload requires multipart adapter" }) },
  { method: "POST", pattern: /^apply$/, perm: "user:create", handler: async (m, { session, body, url }) => onboardingImportService.applyImport({ previewToken: body?.previewToken, actingUserId: session.user.user_id, ...body }) },
];

export async function dispatchOnboardingImportApi({ request, subpath }: DispatchArgs): Promise<Response> {
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
    return jsonError(404, `Unknown onboarding-import endpoint: ${method} ${path}`, "UNKNOWN_ENDPOINT");
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
