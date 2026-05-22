/**
 * @module request-commentApi.server
 * @description Dispatcher para /api/solicitudes/{id}/comments. Para flujos
 * in-app nuevos preferir loader/action directo del slice.
 */
import { jsonOk, jsonError, jsonFromError } from "~/platform/http/responses";
import {
  requireSession,
  requirePermissions,
  runInTenant,
} from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";
import { createRequestComment, readRequestComments } from "~/contexts/workflow";

type DispatchArgs = { request: Request; subpath: string };

type DispatchCtx = {
  session: Awaited<ReturnType<typeof requireSession>>;
  body: Record<string, unknown> | null;
  url: URL;
};

const ROUTES: Array<{
  method: string;
  pattern: RegExp;
  perm: string | null;
  handler: (m: RegExpMatchArray, ctx: DispatchCtx) => Promise<unknown>;
}> = [
  {
    method: "POST",
    pattern: /^(\d+)\/comments$/,
    perm: null,
    handler: async (m, { session, body }) =>
      createRequestComment(
        Number(body?.user_id ?? session.user.user_id),
        Number(m[1]),
        String(body?.content ?? ""),
      ),
  },
  {
    method: "GET",
    pattern: /^(\d+)\/comments$/,
    perm: null,
    handler: async (m, { session, url }) =>
      readRequestComments(
        Number(m[1]),
        Number(url.searchParams.get("user_id") ?? session.user.user_id),
        Number(url.searchParams.get("limit") ?? 50),
        { cursor: url.searchParams.get("cursor") ?? undefined },
      ),
  },
];

export async function dispatchRequestCommentApi({
  request,
  subpath,
}: DispatchArgs): Promise<Response> {
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
      const body =
        method !== "GET" && method !== "HEAD" ? await readJson(request) : null;
      const result = await runInTenant(session, async () =>
        r.handler(m, { session, body, url }),
      );
      return jsonOk(result ?? { ok: true });
    }
    return jsonError(
      404,
      `Unknown request-comment endpoint: ${method} ${path}`,
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
