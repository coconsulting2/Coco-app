/**
 * @module onboarding-importApi.server
 * @description Dispatcher /api/onboarding/import/*. Réplica tipada del controller
 * legacy, delegando en los use-cases hex del slice (no toca el servicio directo).
 * Las rutas RR7 in-app prefieren el action de `routes/_app/admin/onboarding-import.tsx`;
 * este resource route se conserva para compatibilidad con el contrato OpenAPI.
 */
import { jsonOk, jsonError, jsonFromError } from "~/platform/http/responses";
import {
  requireSession,
  requirePermissions,
  runInTenant,
  type ResolvedSession,
} from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";
import {
  previewOnboardingImport,
  applyOnboardingImport,
  type ApplyImportOptions,
} from "~/contexts/onboarding/index.js";

type DispatchArgs = { request: Request; subpath: string };

type HandlerCtx = {
  session: ResolvedSession;
  body: Record<string, unknown> | null;
};

type RouteDef = {
  method: string;
  pattern: RegExp;
  perm: string | null;
  handler: (ctx: HandlerCtx) => Promise<unknown>;
};

function actingUserId(session: ResolvedSession): number {
  return session.user.user_id;
}

const ROUTES: RouteDef[] = [
  {
    method: "POST",
    pattern: /^users\/json$/,
    perm: "user:create",
    handler: async ({ session, body }) => {
      const buffer = Buffer.from(JSON.stringify(body ?? []), "utf-8");
      return previewOnboardingImport({
        buffer,
        mimetype: "application/json",
        originalname: "import.json",
        organizationId: session.organizationId,
        actingUserId: actingUserId(session),
        options: { actorHasOrganizationCreate: session.user.permissionSet?.has("organization:create") },
      });
    },
  },
  {
    method: "POST",
    pattern: /^users\/csv$/,
    perm: "user:create",
    handler: async () => {
      throw new Error("La subida CSV usa el endpoint multipart del panel admin.");
    },
  },
  {
    method: "POST",
    pattern: /^apply$/,
    perm: "user:create",
    handler: async ({ session, body }) => {
      const previewToken = String(body?.previewToken ?? "");
      if (!previewToken) throw new Error("Se requiere el campo previewToken.");
      return applyOnboardingImport({
        previewToken,
        organizationId: session.organizationId,
        actingUserId: actingUserId(session),
        options: extractApplyOptions(body),
      });
    },
  },
];

function extractApplyOptions(body: Record<string, unknown> | null): ApplyImportOptions {
  const b = body ?? {};
  const obj = (v: unknown): Record<string, unknown> | undefined =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;

  return {
    roleMappings: obj(b.roleMappings) as Record<string, string> | undefined,
    roleOverrides: obj(b.roleOverrides) as Record<string, string> | undefined,
    permissionExtras: obj(b.permissionExtras) as Record<string, string[]> | undefined,
    passwordGlobal: typeof b.passwordGlobal === "string" ? b.passwordGlobal : undefined,
    passwordOverrides: obj(b.passwordOverrides) as Record<string, string> | undefined,
    customImportRoles: obj(b.customImportRoles) as ApplyImportOptions["customImportRoles"],
    createNewOrganization: Boolean(b.createNewOrganization),
  };
}

export async function dispatchOnboardingImportApi({ request, subpath }: DispatchArgs): Promise<Response> {
  const method = request.method.toUpperCase();
  const path = subpath.split("?")[0] ?? "";

  try {
    for (const r of ROUTES) {
      if (r.method !== method) continue;
      if (!r.pattern.test(path)) continue;
      const session = r.perm
        ? await requirePermissions(request, r.perm)
        : await requireSession(request);
      if (method !== "GET" && method !== "HEAD") {
        await assertCsrf(request);
      }
      const body = method !== "GET" && method !== "HEAD" ? await readJson(request) : null;
      const result = await runInTenant(session, async () => r.handler({ session, body }));
      return jsonOk(result ?? { ok: true });
    }
    return jsonError(404, `Unknown onboarding-import endpoint: ${method} ${path}`, "UNKNOWN_ENDPOINT");
  } catch (err) {
    return jsonFromError(err);
  }
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const text = await request.text();
    if (!text) return null;
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
