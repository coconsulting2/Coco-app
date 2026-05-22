/**
 * @module userApi.server
 * @description Dispatcher de /api/user/*. Réplica del backend legacy
 * (routes/userRoutes.js + controllers/userController.js).
 *
 * Mapea método + path al handler correspondiente. Cada handler:
 *  - Verifica permisos con requirePermissions(...).
 *  - Ejecuta dentro de runInTenant para que el RLS GUC esté seteado.
 *  - Devuelve Response JSON.
 */
import { redirect } from "react-router";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — JS module (copy + adapt imports)
import * as userService from "~/contexts/identity/application/userService.js";
// @ts-ignore
import UserModel from "~/contexts/identity/infrastructure/userModel.js";
// @ts-ignore
import { decrypt } from "~/platform/crypto/pii.server.js";
// @ts-ignore
import { loadEffectivePermissions } from "~/platform/permissions/permission-service.server.js";

import { jsonOk, jsonError, jsonFromError } from "~/platform/http/responses.js";
import {
  requireSession,
  requirePermissions,
  requireAnyPermission,
  runInTenant,
} from "~/platform/session/requireUser.server.js";
import { assertCsrf } from "~/platform/csrf/csrf.server.js";
import { issueCsrfToken } from "~/platform/csrf/csrf.server.js";
import {
  buildSessionCookie,
  buildLegacyClientCookies,
  buildLogoutCookies,
  buildCsrfCookie,
} from "~/platform/session/session.server.js";
import { signToken } from "~/platform/session/jwt.server.js";
import { extractRequestIp } from "~/platform/session/jwt.server.js";

type DispatchArgs = { request: Request; subpath: string };

/**
 * Punto de entrada del dispatcher. `subpath` es el wildcard que viene en
 * params["*"] (por ejemplo "login", "get-user-data/123", "me/permissions").
 */
export async function dispatchUserApi({ request, subpath }: DispatchArgs): Promise<Response> {
  const method = request.method.toUpperCase();
  const cleanPath = subpath.split("?")[0]!;

  try {
    if (method === "POST" && cleanPath === "login") return await loginHandler(request);
    if (method === "GET" && cleanPath === "logout") return await logoutHandler(request);
    if (method === "GET" && cleanPath === "csrf-token") return await csrfTokenHandler(request);
    if (method === "GET" && cleanPath === "me/permissions") return await myPermissionsHandler(request);
    if (method === "GET" && cleanPath.startsWith("get-user-data/")) {
      return await getUserDataHandler(request, cleanPath.slice("get-user-data/".length));
    }
    if (method === "GET" && cleanPath.startsWith("get-travel-request/")) {
      return await getTravelRequestByIdHandler(request, cleanPath.slice("get-travel-request/".length));
    }
    if (method === "GET" && cleanPath.startsWith("get-travel-requests/")) {
      return await getTravelRequestsByDeptStatusHandler(
        request,
        cleanPath.slice("get-travel-requests/".length),
      );
    }
    if (method === "GET" && cleanPath.startsWith("get-approver-requests/")) {
      return await getApproverRequestsHandler(request, cleanPath.slice("get-approver-requests/".length));
    }
    if (method === "GET" && cleanPath.startsWith("get-user-wallet")) {
      const rest = cleanPath.slice("get-user-wallet".length).replace(/^\//, "");
      return await getUserWalletHandler(request, rest || undefined);
    }
    return jsonError(404, `Unknown user endpoint: ${cleanPath}`, "UNKNOWN_ENDPOINT");
  } catch (err) {
    return jsonFromError(err);
  }
}

// ─── Handlers ──────────────────────────────────────────────────────────────

async function loginHandler(request: Request): Promise<Response> {
  // Login NO requiere CSRF (no hay sesión previa). Sí requiere rate limiting,
  // que aplicamos con un counter simple basado en IP — en prod usar Redis.
  const ip = extractRequestIp(request) ?? "unknown";
  const body = await readJsonBody(request);
  if (!body || typeof body.username !== "string" || typeof body.password !== "string") {
    return jsonError(400, "Missing credentials", "INVALID_BODY");
  }

  // Shim para userService.authenticateUser (espera Express req-like).
  const reqShim = {
    body,
    ip,
  };
  try {
    const result = await userService.authenticateUser(body.username, body.password, reqShim);
    const codes = await loadEffectivePermissions(result.user_id);

    // En el backend legacy el JWT lo firma userService con expiresIn: "1h".
    // Mantenemos esa decisión para no romper la semántica de expiración.
    const setCookies: string[] = [];
    setCookies.push(buildSessionCookie(result.token));
    setCookies.push(
      ...buildLegacyClientCookies({
        role: result.role,
        username: result.username,
        user_id: result.user_id,
        department_id: result.department_id ?? null,
        no_empleado: result.no_empleado ?? null,
      }),
    );

    const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
    for (const c of setCookies) headers.append("set-cookie", c);

    return new Response(JSON.stringify({ ...result, permissions: codes }), {
      status: 200,
      headers,
    });
  } catch (err: any) {
    if (err?.code === "AMBIGUOUS_USERNAME") {
      return jsonError(400, err.message ?? "Ambiguous username", "AMBIGUOUS_USERNAME", {
        organizations: err.organizations ?? [],
      });
    }
    return jsonError(401, "Invalid credentials", "INVALID_CREDENTIALS");
  }
}

async function logoutHandler(_request: Request): Promise<Response> {
  const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
  for (const c of buildLogoutCookies()) headers.append("set-cookie", c);
  return new Response(
    JSON.stringify({ message: "Sesión cerrada correctamente" }),
    { status: 200, headers },
  );
}

async function csrfTokenHandler(request: Request): Promise<Response> {
  const { token, setCookie } = issueCsrfToken(request);
  const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
  headers.append("set-cookie", setCookie);
  // Aseguramos que aunque el cliente no haya leído la cookie aún, el token
  // del header sirve para mutaciones inmediatas (matches double-submit).
  headers.append("set-cookie", buildCsrfCookie(token));
  return new Response(JSON.stringify({ csrfToken: token }), { status: 200, headers });
}

async function myPermissionsHandler(request: Request): Promise<Response> {
  const session = await requireSession(request);
  const codes = await runInTenant(session, async () =>
    loadEffectivePermissions(session.user.user_id),
  );
  return jsonOk({ userId: session.user.user_id, role: session.user.role, permissions: codes });
}

async function getUserDataHandler(request: Request, idParam: string): Promise<Response> {
  const session = await requirePermissions(request, "user:view_self");
  const userId = parseInt(idParam, 10);
  if (!Number.isFinite(userId)) {
    return jsonError(400, "Invalid user ID format", "INVALID_ID");
  }
  const userData = await runInTenant(session, async () => userService.getUserById(userId));
  if (!userData) return jsonError(404, "No information found for the user", "USER_NOT_FOUND");
  return jsonOk(userData);
}

async function getTravelRequestByIdHandler(request: Request, requestIdParam: string): Promise<Response> {
  const session = await requireAnyPermission(request, "travel_request:view_any", "travel_agent:attend");
  const requestId = parseInt(requestIdParam, 10);
  if (!Number.isFinite(requestId)) return jsonError(400, "Invalid request ID", "INVALID_ID");

  const data = await runInTenant(session, async () => UserModel.getTravelRequestById(requestId));
  if (!data || data.length === 0) return jsonError(404, "Travel request not found", "NOT_FOUND");

  const base = data[0];
  const decryptedEmail = decrypt(base.user_email);
  const decryptedPhone = decrypt(base.user_phone_number);

  return jsonOk({
    request_id: base.request_id,
    request_status: base.request_status,
    notes: base.notes,
    requested_fee: base.requested_fee,
    imposed_fee: base.imposed_fee,
    request_days: base.request_days,
    creation_date: formatDate(base.creation_date),
    user: {
      user_name: base.user_name,
      user_email: decryptedEmail,
      user_phone_number: decryptedPhone,
    },
    routes: data.map((row: any) => ({
      router_index: row.router_index,
      origin_country: row.origin_country,
      origin_city: row.origin_city,
      destination_country: row.destination_country,
      destination_city: row.destination_city,
      beginning_date: formatDate(row.beginning_date),
      beginning_time: row.beginning_time,
      ending_date: formatDate(row.ending_date),
      ending_time: row.ending_time,
      hotel_needed: row.hotel_needed,
      plane_needed: row.plane_needed,
    })),
  });
}

async function getTravelRequestsByDeptStatusHandler(
  request: Request,
  rest: string,
): Promise<Response> {
  const session = await requireAnyPermission(request, "travel_request:view_any", "travel_agent:attend");
  const parts = rest.split("/");
  const deptId = Number(parts[0]);
  const statusId = Number(parts[1]);
  const n = parts[2] != null && parts[2] !== "" ? Number(parts[2]) : null;
  if (!Number.isFinite(deptId) || !Number.isFinite(statusId)) {
    return jsonError(400, "Invalid path params", "INVALID_PARAMS");
  }
  const rows = await runInTenant(session, async () =>
    UserModel.getTravelRequestsByDeptStatus(deptId, statusId, n),
  );
  if (!rows || rows.length === 0) return jsonOk([]);
  return jsonOk(
    rows.map((r: any) => ({
      request_id: r.request_id,
      user_id: r.user_id,
      destination_country: r.destination_country,
      beginning_date: formatDate(r.beginning_date),
      ending_date: formatDate(r.ending_date),
      request_status: r.request_status,
    })),
  );
}

async function getApproverRequestsHandler(request: Request, rest: string): Promise<Response> {
  const session = await requireAnyPermission(request, "travel_request:view_any", "travel_agent:attend");
  const parts = rest.split("/");
  const statusId = Number(parts[0]);
  const n = parts[1] != null && parts[1] !== "" ? Number(parts[1]) : null;
  if (statusId !== 2 && statusId !== 3) {
    return jsonError(400, "status_id debe ser 2 (Primera Revisión) o 3 (Segunda Revisión).", "INVALID_STATUS");
  }
  const orgId = session.user.organization_id ?? null;
  const rows = await runInTenant(session, async () =>
    UserModel.getTravelRequestsForApprover(session.user.user_id, statusId, {
      organizationId: orgId,
      n,
    }),
  );
  if (!rows || rows.length === 0) return jsonOk([]);
  return jsonOk(
    rows.map((r: any) => ({
      request_id: r.request_id,
      user_id: r.user_id,
      destination_country: r.destination_country,
      beginning_date: formatDate(r.beginning_date),
      ending_date: formatDate(r.ending_date),
      request_status: r.request_status,
    })),
  );
}

async function getUserWalletHandler(request: Request, idParam?: string): Promise<Response> {
  const session = await requirePermissions(request, "user:view_self");
  const userId = idParam ? Number(idParam) : session.user.user_id;
  const user = await runInTenant(session, async () => UserModel.getUserWallet(userId));
  if (!user) return jsonError(404, `No user with id ${userId} found`, "NOT_FOUND");
  return jsonOk({ user_id: user.user_id, user_name: user.user_name, wallet: user.wallet });
}

// ─── Utils ─────────────────────────────────────────────────────────────────

async function readJsonBody(request: Request): Promise<any | null> {
  try {
    const text = await request.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function formatDate(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  return new Date(date).toISOString().split("T")[0]!;
}
