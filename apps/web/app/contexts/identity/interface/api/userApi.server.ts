/**
 * @module userApi.server
 * @description Dispatcher /api/user/* (Swagger M2). Mapea método + path al
 * handler. Cada handler valida permisos (`requirePermissions`), corre dentro
 * de `runInTenant` para que la RLS quede activa, y serializa la respuesta a
 * snake_case (contrato externo).
 *
 * Hexagonal: invoca use-cases del slice identity, approvals y travel-requests
 * vía la API pública de cada slice — nunca importa infraestructura.
 */
import {
  authenticateUser,
  getUserProfile,
  getUserWallet,
  InvalidCredentialsError,
  AmbiguousUsernameError,
  OrganizationSuspendedError,
  UserInactiveError,
  UserNotFoundError,
} from "~/contexts/identity";
import { getApprovalInbox } from "~/contexts/approvals";
import {
  getTravelRequestDetail,
  listTravelRequestsByDeptStatus,
} from "~/contexts/travel-requests";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — JS module: pending hexagonal refactor en platform/permissions
import { loadEffectivePermissions } from "~/platform/permissions/permission-service.server.js";

import { jsonOk, jsonError, jsonFromError } from "~/platform/http/responses.js";
import {
  requireSession,
  requirePermissions,
  requireAnyPermission,
  runInTenant,
} from "~/platform/session/requireUser.server.js";
import { assertCsrf as _assertCsrf, issueCsrfToken } from "~/platform/csrf/csrf.server.js";
import {
  buildSessionCookie,
  buildLegacyClientCookies,
  buildLogoutCookies,
  buildCsrfCookie,
} from "~/platform/session/session.server.js";
import { extractRequestIp } from "~/platform/session/jwt.server.js";
import { PlatformPiiCipher } from "~/contexts/identity/infrastructure/PlatformPiiCipher.js";

type DispatchArgs = { request: Request; subpath: string };

const cipher = new PlatformPiiCipher();

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
  const ip = extractRequestIp(request) ?? "unknown";
  const body = await readJsonBody(request);
  if (!body || typeof body.username !== "string" || typeof body.password !== "string") {
    return jsonError(400, "Missing credentials", "INVALID_BODY");
  }

  try {
    const result = await authenticateUser({
      username: body.username,
      password: body.password,
      ip,
      organizationHint:
        (body.organization_id as string | number | null | undefined) ??
        (body.organizationId as string | number | null | undefined) ??
        null,
    });
    const codes = await loadEffectivePermissions(result.userId);

    const setCookies: string[] = [];
    setCookies.push(buildSessionCookie(result.token));
    setCookies.push(
      ...buildLegacyClientCookies({
        role: result.role,
        username: result.username,
        user_id: result.userId,
        department_id: result.departmentId,
        no_empleado: result.employeeNumber,
      }),
    );

    const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
    for (const c of setCookies) headers.append("set-cookie", c);

    // Wire shape: snake_case (legacy contract M2 Swagger).
    return new Response(
      JSON.stringify({
        token: result.token,
        role: result.role,
        username: result.username,
        user_id: result.userId,
        organization_id: result.organizationId.toString(),
        organization_kind: result.organizationKind,
        department_id: result.departmentId,
        no_empleado: result.employeeNumber,
        permissions: codes,
      }),
      { status: 200, headers },
    );
  } catch (err) {
    if (err instanceof AmbiguousUsernameError) {
      return jsonError(400, err.message, "AMBIGUOUS_USERNAME", {
        organizations: err.organizations,
      });
    }
    if (err instanceof OrganizationSuspendedError) {
      return jsonError(403, err.message, err.code);
    }
    if (err instanceof UserInactiveError) {
      return jsonError(403, err.message, err.code);
    }
    if (err instanceof InvalidCredentialsError) {
      return jsonError(401, err.message, err.code);
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
  try {
    const profile = await runInTenant(session, async () => getUserProfile(userId));
    return jsonOk({
      user_id: profile.userId,
      user_name: profile.username,
      email: profile.email,
      phone_number: profile.phoneNumber,
      workstation: profile.workstation,
      no_empleado: profile.employeeNumber,
      department_name: profile.departmentName,
      costs_center: profile.costsCenter,
      creation_date: profile.creationDate,
      role_name: profile.roleName,
    });
  } catch (err) {
    if (err instanceof UserNotFoundError) {
      return jsonError(404, "No information found for the user", "USER_NOT_FOUND");
    }
    throw err;
  }
}

async function getTravelRequestByIdHandler(request: Request, requestIdParam: string): Promise<Response> {
  const session = await requireAnyPermission(request, "travel_request:view_any", "travel_agent:attend");
  const requestId = parseInt(requestIdParam, 10);
  if (!Number.isFinite(requestId)) return jsonError(400, "Invalid request ID", "INVALID_ID");

  const rows = await runInTenant(session, async () => getTravelRequestDetail(requestId));
  if (rows.length === 0) return jsonError(404, "Travel request not found", "NOT_FOUND");

  const base = rows[0]!;
  const decryptedEmail = base.userEmail ? cipher.decrypt(base.userEmail) : null;
  const decryptedPhone = base.userPhoneNumber ? cipher.decrypt(base.userPhoneNumber) : null;

  return jsonOk({
    request_id: base.requestId,
    request_status: base.requestStatus,
    notes: base.notes,
    requested_fee: base.requestedFee,
    imposed_fee: base.imposedFee,
    request_days: base.requestDays,
    creation_date: formatDate(base.creationDate),
    user: {
      user_name: base.userName,
      user_email: decryptedEmail,
      user_phone_number: decryptedPhone,
    },
    routes: rows.map((row) => ({
      router_index: row.routerIndex,
      origin_country: row.originCountry,
      origin_city: row.originCity,
      destination_country: row.destinationCountry,
      destination_city: row.destinationCity,
      beginning_date: formatDate(row.beginningDate),
      beginning_time: row.beginningTime,
      ending_date: formatDate(row.endingDate),
      ending_time: row.endingTime,
      hotel_needed: row.hotelNeeded,
      plane_needed: row.planeNeeded,
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
    listTravelRequestsByDeptStatus(deptId, statusId, n),
  );
  return jsonOk(
    rows.map((r) => ({
      request_id: r.requestId,
      user_id: r.userId,
      destination_country: r.destinationCountry,
      beginning_date: formatDate(r.beginningDate),
      ending_date: formatDate(r.endingDate),
      request_status: r.requestStatus,
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
  const rows = await runInTenant(session, async () =>
    getApprovalInbox(session.user.user_id, statusId as 2 | 3, {
      organizationId: session.organizationId,
      n,
    }),
  );
  return jsonOk(
    rows.map((r) => ({
      request_id: r.requestId,
      user_id: r.userId,
      destination_country: r.destinationCountry,
      beginning_date: formatDate(r.beginningDate),
      ending_date: formatDate(r.endingDate),
      request_status: r.requestStatus,
    })),
  );
}

async function getUserWalletHandler(request: Request, idParam?: string): Promise<Response> {
  const session = await requirePermissions(request, "user:view_self");
  const userId = idParam ? Number(idParam) : session.user.user_id;
  const user = await runInTenant(session, async () => getUserWallet(userId));
  if (!user) return jsonError(404, `No user with id ${userId} found`, "NOT_FOUND");
  return jsonOk({ user_id: user.userId, user_name: user.username, wallet: user.wallet });
}

// ─── Utils ─────────────────────────────────────────────────────────────────

async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const text = await request.text();
    if (!text) return null;
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function formatDate(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  return new Date(date).toISOString().split("T")[0]!;
}
