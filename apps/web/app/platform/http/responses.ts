/**
 * @module responses
 * @description Helpers para construir Response JSON en loaders/actions.
 * Reemplaza `res.json(...)` + `res.status(...)` de Express por las APIs
 * web-native que React Router v7 espera.
 *
 * Importante: BigInt.toJSON ya está parcheado en entry.server.tsx para
 * que Prisma BigInt (Organization.id, etc.) serialice como string.
 */

export type JsonInit = { status?: number; headers?: HeadersInit };

export function jsonOk<T>(body: T, init: JsonInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers ?? {}),
    },
  });
}

export type JsonErrorBody = {
  statusCode: number;
  message: string;
  error: string;
  [extra: string]: unknown;
};

export function jsonError(
  statusCode: number,
  message: string,
  errorCode: string,
  extra: Record<string, unknown> = {},
  headers: HeadersInit = {},
): Response {
  const body: JsonErrorBody = { statusCode, message, error: errorCode, ...extra };
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

export function noContent(headers: HeadersInit = {}): Response {
  return new Response(null, { status: 204, headers });
}

/**
 * Convierte un objeto error con .statusCode/.status/.message en una Response JSON.
 * Útil para `try { ... } catch (err) { return jsonFromError(err); }` en actions.
 */
export function jsonFromError(err: unknown): Response {
  if (err instanceof Response) return err;
  const e = err as { statusCode?: number; status?: number; message?: string; error?: string };
  const status = e?.statusCode ?? e?.status ?? 500;
  const message = e?.message ?? "Internal server error";
  const errorCode = e?.error ?? "INTERNAL_ERROR";
  return jsonError(status, message, errorCode);
}
