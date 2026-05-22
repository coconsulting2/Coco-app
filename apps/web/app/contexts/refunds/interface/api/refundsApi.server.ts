/**
 * @module refundsApi.server
 * @description Dispatcher /api/refunds/*. El endpoint legacy /rules llamaba
 * `refundRuleEngine.listRules?.()` que no existe — se removió. Para flujos
 * in-app nuevos, importa directo del slice public API.
 */
import { jsonOk, jsonError, jsonFromError } from "~/platform/http/responses";
import { requirePermissions, runInTenant } from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — JS module (policies pendiente sesión H)
import * as policyExceptionService from "~/contexts/policies/application/policyExceptionService.js";

type DispatchArgs = { request: Request; subpath: string };

type DispatchCtx = {
  session: Awaited<ReturnType<typeof requirePermissions>>;
  body: Record<string, unknown> | null;
};

const ROUTES: Array<{
  method: string;
  pattern: RegExp;
  handler: (m: RegExpMatchArray, ctx: DispatchCtx) => Promise<unknown>;
}> = [
  {
    method: "GET",
    pattern: /^exceptions$/,
    handler: async () => policyExceptionService.listExceptions(),
  },
];

export async function dispatchRefundsApi({
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
      const body =
        method !== "GET" && method !== "HEAD" ? await readJson(request) : null;
      const result = await runInTenant(session, async () =>
        r.handler(m, { session, body }),
      );
      return jsonOk(result ?? { ok: true });
    }
    return jsonError(404, `Unknown refunds endpoint: ${method} ${path}`, "UNKNOWN_ENDPOINT");
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
