/**
 * @module csrf.server
 * @description CSRF double-submit cookie pattern. Reemplaza csurf de Express.
 *
 * Modo de operación:
 *   1. `issueCsrfToken()` genera un token aleatorio (32 bytes hex) y lo persiste
 *      en cookie `coco_csrf` (SameSite=Strict, NO httpOnly para que JS lo lea).
 *   2. Los `<Form>` o fetches deben incluir el mismo token en el body (campo
 *      `_csrf`), en query string, o en header `x-csrf-token`.
 *   3. `assertCsrf(request)` compara cookie ↔ submitted; falla con 403 si no coinciden.
 *
 * Exenciones:
 *   - GET / HEAD / OPTIONS (idempotentes, no requieren CSRF).
 *   - POST /api/user/login (no hay sesión previa).
 *   - GET /api/user/csrf-token (devuelve token fresco).
 */
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readCsrfCookie, buildCsrfCookie } from "../session/session.server.js";

/**
 * Nombres de header que aceptamos para el token CSRF. El frontend legacy
 * (`apiClient.ts`) envía `csrf-token` sin prefijo `x-`; convención más común
 * en otros stacks es `x-csrf-token`. Aceptamos ambos para no romper compat.
 */
export const CSRF_HEADER_NAMES = ["csrf-token", "x-csrf-token"] as const;
export const CSRF_HEADER_NAME = CSRF_HEADER_NAMES[0]; // legacy-compat primary
export const CSRF_BODY_FIELD = "_csrf";

export function generateCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Devuelve un token CSRF, generando uno nuevo si no hay cookie previa.
 * El caller debe escribir `Set-Cookie` con `buildCsrfCookie(token)` para
 * persistirlo (típicamente en la respuesta del loader que lo expone).
 */
export function issueCsrfToken(request: Request): { token: string; setCookie: string } {
  const existing = readCsrfCookie(request);
  const token = existing && existing.length === 64 ? existing : generateCsrfToken();
  return {
    token,
    setCookie: buildCsrfCookie(token),
  };
}

/**
 * Compara dos tokens de forma resistente a timing attacks.
 */
function safeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf-8");
  const bb = Buffer.from(b, "utf-8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Extrae el token enviado por el cliente. Orden de prioridad:
 *   1. header `x-csrf-token`
 *   2. campo `_csrf` en form data
 *   3. campo `_csrf` en JSON body
 *
 * Como `request.body` se consume al leerlo, el caller debe pasar el body ya
 * parseado o usar un Request clonado.
 */
export async function extractSubmittedToken(request: Request): Promise<string | null> {
  for (const name of CSRF_HEADER_NAMES) {
    const v = request.headers.get(name);
    if (v) return v;
  }

  // Probar form data primero (no destruye body si es JSON)
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const cloned = request.clone();
      const form = await cloned.formData();
      const v = form.get(CSRF_BODY_FIELD);
      if (typeof v === "string") return v;
    } else if (contentType.includes("application/json")) {
      const cloned = request.clone();
      const text = await cloned.text();
      if (!text) return null;
      try {
        const json = JSON.parse(text);
        if (json && typeof json[CSRF_BODY_FIELD] === "string") return json[CSRF_BODY_FIELD];
      } catch {
        return null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Verifica CSRF. Lanza Response 403 si falla. Llama esto al inicio de toda
 * `action` que mute estado, EXCEPTO en /login y /api/user/csrf-token.
 */
export async function assertCsrf(request: Request): Promise<void> {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;

  const cookieToken = readCsrfCookie(request);
  if (!cookieToken) {
    throw new Response(
      JSON.stringify({
        statusCode: 403,
        message: "Invalid or missing CSRF token",
        error: "EBADCSRFTOKEN",
      }),
      { status: 403, headers: { "content-type": "application/json" } },
    );
  }

  const submitted = await extractSubmittedToken(request);
  if (!submitted || !safeEquals(cookieToken, submitted)) {
    throw new Response(
      JSON.stringify({
        statusCode: 403,
        message: "Invalid or missing CSRF token",
        error: "EBADCSRFTOKEN",
      }),
      { status: 403, headers: { "content-type": "application/json" } },
    );
  }
}

/**
 * URLs exentas del check CSRF: login y el propio endpoint que distribuye el token.
 */
const CSRF_EXEMPT_PATHS = new Set([
  "/api/user/login",
  "/api/user/csrf-token",
]);

export function isCsrfExempt(pathname: string, method: string): boolean {
  if (method.toUpperCase() === "GET" && pathname === "/api/user/csrf-token") return true;
  if (method.toUpperCase() === "POST" && pathname === "/api/user/login") return true;
  return CSRF_EXEMPT_PATHS.has(pathname);
}
