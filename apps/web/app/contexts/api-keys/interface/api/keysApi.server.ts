/**
 * @module keysApi.server
 * @description Dispatcher /api/keys/* — preservado para contrato OpenAPI.
 * Para flujos in-app, importa use-cases directo del slice `@/contexts/api-keys`.
 */
import { jsonOk, jsonError, jsonFromError } from "~/platform/http/responses";
import { requirePermissions, runInTenant } from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";
import {
  issueApiKey,
  revokeApiKey,
  listApiKeysForOrg,
  listAuditLogs,
} from "~/contexts/api-keys";

type DispatchArgs = { request: Request; subpath: string };

type DispatchCtx = {
  session: Awaited<ReturnType<typeof requirePermissions>>;
  body: Record<string, unknown> | null;
  url: URL;
};

const ROUTES: Array<{
  method: string;
  pattern: RegExp;
  handler: (m: RegExpMatchArray, ctx: DispatchCtx) => Promise<unknown>;
}> = [
  {
    method: "GET",
    pattern: /^$/,
    handler: async (_m, { session }) => listApiKeysForOrg(session.organizationId),
  },
  {
    method: "POST",
    pattern: /^$/,
    handler: async (_m, { session, body }) => {
      const scope = (body as { scope?: unknown })?.scope;
      const expiresAt = (body as { expires_at?: string | Date })?.expires_at;
      if (!expiresAt) {
        throw new Error("expires_at requerido");
      }
      return issueApiKey({
        orgId: session.organizationId,
        scope,
        expiresAt,
        createdBy: session.user.user_id,
      });
    },
  },
  {
    method: "POST",
    pattern: /^(\d+)\/revoke$/,
    handler: async (m) => revokeApiKey(Number(m[1])),
  },
  {
    method: "GET",
    pattern: /^(\d+)\/logs$/,
    handler: async (m, { url }) =>
      listAuditLogs(Number(m[1]), {
        limit: url.searchParams.get("limit") ?? undefined,
        cursor: url.searchParams.get("cursor") ?? undefined,
      }),
  },
];

export async function dispatchKeysApi({
  request,
  subpath,
}: DispatchArgs): Promise<Response> {
  const method = request.method.toUpperCase();
  const path = subpath.split("?")[0] ?? "";
  const url = new URL(request.url);

  try {
    const session = await requirePermissions(request, "api_key:manage");
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
        r.handler(m, { session, body, url }),
      );
      return jsonOk(result ?? { ok: true });
    }
    return jsonError(404, `Unknown keys endpoint: ${method} ${path}`, "UNKNOWN_ENDPOINT");
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
