/**
 * @module adminApi.server
 * @description Dispatcher /api/admin/*. Cada loader/action in-app debería
 * preferir DI directo a los use-cases del slice (via `~/contexts/identity`);
 * este resource route se conserva para compatibilidad con el contrato
 * OpenAPI/Swagger M2.
 *
 * Hexagonal: invoca use-cases del slice identity vía la API pública (sin
 * tocar `infrastructure/` ni `application/*` directos).
 */
import { jsonOk, jsonError, jsonFromError } from "~/platform/http/responses";
import {
  requireSession,
  requirePermissions,
  runInTenant,
} from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";
import {
  listUsersForAdmin,
  createUser,
  updateUserData,
  deactivateUser,
  type CreateUserInput,
} from "~/contexts/identity";

type DispatchArgs = { request: Request; subpath: string };

type RouteCtx = {
  session: Awaited<ReturnType<typeof requireSession>>;
  body: Record<string, unknown> | null;
};

type Handler = (match: RegExpMatchArray, ctx: RouteCtx) => Promise<unknown>;

type RouteSpec = { method: string; pattern: RegExp; perm: string | null; handler: Handler };

const ROUTES: ReadonlyArray<RouteSpec> = [
  {
    method: "GET",
    pattern: /^get-user-list$/,
    perm: "user:list",
    handler: async () => {
      const rows = await listUsersForAdmin();
      // Wire shape snake_case (legacy contract).
      return rows.map((u) => ({
        user_id: u.userId,
        user_name: u.username,
        email: u.emailDecrypted,
        active: u.active,
        role_name: u.roleName,
        department_name: u.departmentName,
        department_id: u.departmentId,
        phone_number: u.phoneNumberDecrypted,
        organization_id: u.organizationId,
        organization_name: u.organizationName,
      }));
    },
  },
  {
    method: "POST",
    pattern: /^create-user$/,
    perm: "user:create",
    handler: async (_m, { session, body }) => {
      if (!body) throw new Error("Missing body");
      const orgRaw = body.organization_id;
      const organizationId: string | bigint =
        typeof orgRaw === "bigint"
          ? orgRaw
          : orgRaw != null
            ? String(orgRaw)
            : session.organizationId;
      const input: CreateUserInput = {
        organizationId,
        roleId: Number(body.role_id),
        departmentId: Number(body.department_id),
        username: String(body.user_name ?? ""),
        password: String(body.password ?? ""),
        workstation: String(body.workstation ?? ""),
        email: String(body.email ?? ""),
        phoneNumber: String(body.phone_number ?? ""),
      };
      const profile = await createUser(input);
      return { user_id: profile.userId, user_name: profile.username };
    },
  },
  {
    method: "PUT",
    pattern: /^update-user\/(\d+)$/,
    perm: "user:edit",
    handler: async (match, { body }) => {
      const idStr = match[1];
      if (!idStr) throw new Error("Missing user_id");
      const result = await updateUserData(Number(idStr), (body ?? {}) as Record<string, unknown>);
      return result;
    },
  },
  {
    method: "PUT",
    pattern: /^delete-user\/(\d+)$/,
    perm: "user:edit",
    handler: async (match) => {
      const idStr = match[1];
      if (!idStr) throw new Error("Missing user_id");
      await deactivateUser(Number(idStr));
      return { ok: true };
    },
  },
];

export async function dispatchAdminApi({ request, subpath }: DispatchArgs): Promise<Response> {
  const method = request.method.toUpperCase();
  const path = subpath.split("?")[0] ?? "";

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
      const result = await runInTenant(session, async () => r.handler(m, { session, body }));
      return jsonOk(result ?? { ok: true });
    }
    return jsonError(404, `Unknown admin endpoint: ${method} ${path}`, "UNKNOWN_ENDPOINT");
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
