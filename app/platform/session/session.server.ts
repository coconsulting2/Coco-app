/**
 * @module session.server
 * @description Cookie-based session storage (httpOnly, Secure, SameSite=Lax) +
 * helpers para serializar/parsear cookies. Almacena el JWT firmado por el backend
 * legacy. Cualquier loader/action server-side lo lee con `getSessionToken(request)`.
 *
 * El JWT vive en la cookie `coco_session` (configurable por env). Además
 * conservamos cookies legibles por JS (`role`, `username`, `user_id`,
 * `department_id`, `no_empleado`, `imp_org_id`) para el middleware y el sidebar,
 * pero el token NUNCA es accesible desde JS — solo desde el server.
 */
import { parse, serialize, type SerializeOptions } from "cookie";

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "coco_session";
const CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME ?? "coco_csrf";
const SESSION_MAX_AGE_SECONDS =
  Number(process.env.SESSION_MAX_AGE_DAYS ?? "7") * 24 * 60 * 60;

const IS_PROD = process.env.NODE_ENV === "production";

export type SessionCookies = {
  token: string | null;
  role: string | null;
  username: string | null;
  userId: string | null;
  departmentId: string | null;
  noEmpleado: string | null;
  impersonatedOrgId: string | null;
};

/**
 * Parsea TODAS las cookies relevantes de una Request RRv7.
 * Devuelve null en cada campo si la cookie no existe.
 */
export function readCookies(request: Request): SessionCookies {
  const header = request.headers.get("cookie") ?? "";
  const c = parse(header);
  return {
    token: c[SESSION_COOKIE_NAME] ?? c["token"] ?? null,
    role: c["role"] ?? null,
    username: c["username"] ?? null,
    userId: c["user_id"] ?? c["id"] ?? null,
    departmentId: c["department_id"] ?? null,
    noEmpleado: c["no_empleado"] ?? null,
    impersonatedOrgId: c["imp_org_id"] ?? null,
  };
}

export function readSessionToken(request: Request): string | null {
  return readCookies(request).token;
}

export function readCsrfCookie(request: Request): string | null {
  const header = request.headers.get("cookie") ?? "";
  const c = parse(header);
  return c[CSRF_COOKIE_NAME] ?? null;
}

const COOKIE_BASE: SerializeOptions = {
  path: "/",
  sameSite: "lax",
  secure: IS_PROD,
};

/**
 * Construye un Set-Cookie httpOnly seguro para el JWT.
 */
export function buildSessionCookie(token: string): string {
  return serialize(SESSION_COOKIE_NAME, token, {
    ...COOKIE_BASE,
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/**
 * Construye cookies legibles por JS con los campos no-sensibles (rol, nombre, etc.)
 * para compatibilidad con componentes legacy que las leen de document.cookie.
 */
export function buildLegacyClientCookies(payload: {
  role: string;
  username?: string;
  user_id?: number | string;
  department_id?: number | string | null;
  no_empleado?: string | null;
}): string[] {
  const out: string[] = [];
  const baseOpts: SerializeOptions = {
    ...COOKIE_BASE,
    maxAge: SESSION_MAX_AGE_SECONDS,
    httpOnly: false,
  };
  out.push(serialize("role", payload.role, baseOpts));
  if (payload.username) out.push(serialize("username", String(payload.username), baseOpts));
  if (payload.user_id != null) out.push(serialize("user_id", String(payload.user_id), baseOpts));
  if (payload.department_id != null)
    out.push(serialize("department_id", String(payload.department_id), baseOpts));
  if (payload.no_empleado != null)
    out.push(serialize("no_empleado", String(payload.no_empleado), baseOpts));
  return out;
}

/** Cookie para el CSRF double-submit (legible por JS para el <input hidden>). */
export function buildCsrfCookie(token: string): string {
  return serialize(CSRF_COOKIE_NAME, token, {
    ...COOKIE_BASE,
    sameSite: "strict",
    httpOnly: false,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function buildImpersonationCookie(orgId: string | null): string {
  if (orgId == null) {
    return serialize("imp_org_id", "", {
      ...COOKIE_BASE,
      httpOnly: true,
      maxAge: 0,
    });
  }
  return serialize("imp_org_id", orgId, {
    ...COOKIE_BASE,
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/** Devuelve una lista de Set-Cookie headers que invalidan la sesión. */
export function buildLogoutCookies(): string[] {
  const expire: SerializeOptions = { ...COOKIE_BASE, maxAge: 0 };
  return [
    serialize(SESSION_COOKIE_NAME, "", { ...expire, httpOnly: true }),
    serialize("role", "", expire),
    serialize("username", "", expire),
    serialize("user_id", "", expire),
    serialize("department_id", "", expire),
    serialize("no_empleado", "", expire),
    serialize("imp_org_id", "", { ...expire, httpOnly: true }),
  ];
}

export const SESSION_COOKIE_NAMES = {
  session: SESSION_COOKIE_NAME,
  csrf: CSRF_COOKIE_NAME,
} as const;
