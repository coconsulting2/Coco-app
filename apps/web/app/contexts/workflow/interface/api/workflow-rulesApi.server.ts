/**
 * @module workflow-rulesApi.server
 * @description Dispatcher /api/workflow-rules/* — preservado para compatibilidad
 * con componentes legacy que lo consumen vía apiClient + contrato OpenAPI.
 * Para flujos in-app nuevos, prefiere actions/loaders directos (DI).
 */
import { jsonOk, jsonError, jsonFromError } from "~/platform/http/responses";
import { requirePermissions, runInTenant } from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";
import {
  listWorkflowRules,
  getWorkflowRule,
  createWorkflowRule,
  updateWorkflowRule,
} from "~/contexts/workflow";
import type { WorkflowRuleInput } from "~/contexts/workflow";

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
    pattern: /^$/,
    handler: async (_m, { session }) =>
      listWorkflowRules(BigInt(session.organizationId)),
  },
  {
    method: "GET",
    pattern: /^(\d+)$/,
    handler: async (m) => getWorkflowRule(Number(m[1])),
  },
  {
    method: "POST",
    pattern: /^$/,
    handler: async (_m, { session, body }) =>
      createWorkflowRule({
        ...(body as Partial<WorkflowRuleInput>),
        organizationId: BigInt(session.organizationId),
      } as WorkflowRuleInput),
  },
  {
    method: "PUT",
    pattern: /^(\d+)$/,
    handler: async (m, { body }) =>
      updateWorkflowRule(Number(m[1]), (body ?? {}) as Partial<WorkflowRuleInput>),
  },
];

export async function dispatchWorkflowRulesApi({
  request,
  subpath,
}: DispatchArgs): Promise<Response> {
  const method = request.method.toUpperCase();
  const path = subpath.split("?")[0] ?? "";

  try {
    const session = await requirePermissions(request, "workflow:manage");
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
    return jsonError(
      404,
      `Unknown workflow-rules endpoint: ${method} ${path}`,
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
