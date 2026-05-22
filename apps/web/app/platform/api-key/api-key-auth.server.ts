/**
 * @module apiKeyAuth
 * @description Helpers RR7 (no Express) para autenticar requests vía API key.
 * Extrae el secreto de cabecera, lo resuelve contra la tabla `api_keys`,
 * verifica scope y registra en `api_key_logs`.
 */
import {
  authenticateApiKey as authenticateApiKeyUseCase,
  logApiKeyUsage,
  scopeHasAllPermissions,
  scopeHasAnyPermission,
  InvalidApiKeyError,
  InsufficientApiKeyScopeError,
  type ApiKeyRecord,
} from "~/contexts/api-keys";

/** Extrae el secreto crudo de la petición sin validarlo. */
export function extractApiKeyFromRequest(request: Request): string | null {
  const fromHeader = request.headers.get("x-api-key");
  if (typeof fromHeader === "string" && fromHeader.trim().length > 0) {
    return fromHeader.trim();
  }
  const auth = request.headers.get("authorization");
  if (auth && auth.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    if (token.length > 0) return token;
  }
  return null;
}

/**
 * Resuelve la API key activa para el request. Devuelve `null` si no hay
 * header con clave; lanza si la clave es inválida/revocada/vencida.
 */
export async function authenticateApiKey(
  request: Request,
): Promise<ApiKeyRecord | null> {
  const plain = extractApiKeyFromRequest(request);
  if (!plain) return null;
  return authenticateApiKeyUseCase(plain);
}

/** Registra una fila en `api_key_logs` (fire-and-forget seguro). */
export async function apiKeyAuditLog(
  apiKey: ApiKeyRecord,
  meta: { method: string; path: string; statusCode?: number },
): Promise<void> {
  const endpoint = `${meta.method} ${meta.path}`;
  await logApiKeyUsage(apiKey, endpoint, meta.statusCode ?? null);
}

/** Asserts que el scope tenga todos los permisos. Lanza si falta alguno. */
export function requireApiKeyPermission(
  apiKey: ApiKeyRecord,
  ...permissionCodes: string[]
): void {
  if (!scopeHasAllPermissions(apiKey.scope, ...permissionCodes)) {
    throw new InsufficientApiKeyScopeError();
  }
}

/** Asserts que el scope tenga al menos uno de los permisos. */
export function requireAnyApiKeyPermission(
  apiKey: ApiKeyRecord,
  ...permissionCodes: string[]
): void {
  if (!scopeHasAnyPermission(apiKey.scope, ...permissionCodes)) {
    throw new InsufficientApiKeyScopeError();
  }
}

export { InvalidApiKeyError, InsufficientApiKeyScopeError };
