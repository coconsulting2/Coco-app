/**
 * @module requireUser.server
 * @description Helper compuesto para loaders/actions protegidos:
 *   1. Lee cookie httpOnly.
 *   2. Verifica JWT (firma, expiración, IP, organization_id grace period).
 *   3. Resuelve tenant context (jwt org_id o X-Organization-Id si organization_kind=ROOT).
 *   4. Aplica RLS GUC `app.current_organization_id` a la sesión Postgres.
 *   5. Carga permission set efectivo (rol + grupos + grants).
 *   6. (Opcional) Verifica que el usuario tenga TODOS los permisos pedidos.
 *
 * Equivalente al chain `requirePermission(...perms)` de Express en el backend
 * legacy: [authenticateToken, tenantContextMiddleware, applyRlsForRequest,
 * loadPermissions, authorizePermission(...)].
 *
 * Toda función que toque la BD debe usar este helper o `requireSession` y luego
 * ejecutar su trabajo dentro del callback devuelto (que entra al
 * AsyncLocalStorage del tenant context).
 */
import { redirect } from "react-router";
import { decodeRequestUser, extractRequestIp, type SessionUser } from "~/platform/session/jwt.server.js";
import { readCookies } from "~/platform/session/session.server.js";
import { withTenantContext } from "~/platform/db/tenant-context.server.js";
import { applyRlsSetting, withRls, type RlsTransaction } from "~/platform/db/rls.server.js";
import { loadEffectivePermissions } from "~/platform/permissions/permission-service.server.js";
import {
  InsufficientPermissionsError,
  AuthError,
} from "~/platform/http/errors.server.js";

export type ResolvedSession = {
  user: SessionUser;
  /** organizationId activo (post-impersonate). BigInt para tipos Prisma. */
  organizationId: bigint;
  /** organization_id original del JWT. */
  jwtOrgId: bigint | null;
  isRoot: boolean;
  bypassTenant: boolean;
  csrfTokenCookie: string | null;
};

/**
 * Resuelve la sesión sin verificar permisos. Útil para layouts y endpoints
 * que solo necesitan saber que el usuario está autenticado.
 *
 * Si no hay token o falla la verificación: redirige a /login (loaders) o
 * devuelve Response 401 (actions) — usar `requireSessionForAction` en actions.
 */
export async function requireSession(request: Request): Promise<ResolvedSession> {
  const cookies = readCookies(request);
  const ip = extractRequestIp(request);
  let user: SessionUser;
  try {
    user = await decodeRequestUser(cookies.token, ip);
  } catch (err) {
    throw redirect("/login");
  }

  const jwtOrgId =
    user.organization_id != null ? BigInt(user.organization_id) : null;
  const isRoot = user.organization_kind === "ROOT";

  let activeOrgId = jwtOrgId;
  let bypassTenant = false;
  const headerOrg = request.headers.get("x-organization-id") ?? cookies.impersonatedOrgId;
  if (headerOrg && isRoot) {
    try {
      activeOrgId = BigInt(headerOrg);
      bypassTenant = jwtOrgId == null ? true : activeOrgId !== jwtOrgId;
    } catch {
      throw new Response(JSON.stringify({ error: "X-Organization-Id inválido" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
  }

  if (activeOrgId == null) {
    // Mock user en dev sin orgId o token legacy en grace period: continuar sin RLS.
    return {
      user,
      organizationId: 0n,
      jwtOrgId,
      isRoot,
      bypassTenant,
      csrfTokenCookie: null,
    };
  }

  return {
    user,
    organizationId: activeOrgId,
    jwtOrgId,
    isRoot,
    bypassTenant,
    csrfTokenCookie: null,
  };
}

/**
 * Variante para actions: si falla la auth, devuelve Response 401 con JSON
 * en lugar de redirect (los actions de API no deberían redirigir).
 */
export async function requireSessionForAction(request: Request): Promise<ResolvedSession> {
  try {
    return await requireSession(request);
  } catch (err) {
    if (err instanceof Response && err.status >= 300 && err.status < 400) {
      return Promise.reject(
        new Response(
          JSON.stringify({
            statusCode: 401,
            message: "Authentication required",
            error: "UNAUTHENTICATED",
          }),
          { status: 401, headers: { "content-type": "application/json" } },
        ),
      );
    }
    throw err;
  }
}

/**
 * Resuelve sesión + verifica todos los permisos requeridos (AND semantics).
 * Equivalente a `requirePermission(...perms)` de Express.
 *
 * NO ejecuta el trabajo dentro de tenant context — debes envolver con
 * `runInTenant(session, work)` o `runInRls(session, work)` para queries.
 */
export async function requirePermissions(
  request: Request,
  ...perms: string[]
): Promise<ResolvedSession> {
  const session = await requireSession(request);
  // Carga permisos efectivos del usuario (rol + grupos + grants directos + capacidad tenant).
  const codes = await runInTenant(session, async () => loadEffectivePermissions(session.user.user_id));
  session.user.permissionSet = new Set(codes);
  if (perms.length > 0) {
    const ok = perms.every((c) => session.user.permissionSet!.has(c));
    if (!ok) {
      throw new InsufficientPermissionsError();
    }
  }
  return session;
}

/**
 * Variante "al menos uno" (OR semantics). Igual a `requireAnyPermission` legacy.
 */
export async function requireAnyPermission(
  request: Request,
  ...perms: string[]
): Promise<ResolvedSession> {
  const session = await requireSession(request);
  const codes = await runInTenant(session, async () => loadEffectivePermissions(session.user.user_id));
  session.user.permissionSet = new Set(codes);
  if (perms.length > 0) {
    const ok = perms.some((c) => session.user.permissionSet!.has(c));
    if (!ok) {
      throw new InsufficientPermissionsError();
    }
  }
  return session;
}

/**
 * Ejecuta `work` dentro del AsyncLocalStorage del tenant. Las queries Prisma
 * dentro del callback aplican RLS automáticamente vía tenant-extension.server.js
 * (que inyecta SET LOCAL `app.current_organization_id` por transacción).
 *
 * Adicionalmente, antes de ejecutar `work`, hace SET de sesión (no transactional)
 * para queries que NO van dentro de un $transaction explícito.
 */
export async function runInTenant<T>(
  session: ResolvedSession,
  work: () => Promise<T>,
): Promise<T> {
  if (session.organizationId === 0n) {
    // Sin tenant resuelto: mock dev sin orgId o token legacy en grace period.
    // En no-prod fallamos ruidosamente porque cualquier query bajo RLS policy
    // activa va a devolver cero rows silenciosamente (current_setting('') ->
    // cast a bigint falla y la policy no matchea). Era la causa probable del
    // bug del Solicitante M7.
    const msg = `runInTenant ejecutado sin organizationId (userId=${session.user.user_id}). Las queries RLS van a devolver vacío silenciosamente.`;
    if (process.env.NODE_ENV !== "production") {
      throw new Error(`[runInTenant] ${msg}`);
    }
    console.warn(`[runInTenant] ${msg}`);
    return work();
  }
  return withTenantContext(
    {
      organizationId: session.organizationId,
      userId: session.user.user_id,
      isRoot: session.isRoot,
      bypassTenant: session.bypassTenant,
    },
    async () => {
      // SET de sesión (sobrescribe en el connection pool). Usar
      // `runInRls(session, work)` para garantía transaccional estricta.
      await applyRlsSetting(session.organizationId, { bypass: session.bypassTenant });
      return work();
    },
  );
}

/**
 * Variante TRANSACCIONAL del wrapper de tenant: las queries dentro del callback
 * ejecutan bajo `SELECT set_config(..., true)` en una transacción dedicada.
 * Garantiza aislamiento estricto: el bypass NO se filtra a otros requests
 * por reutilización del pool. Úsalo para operaciones de super-admin Ditta
 * cross-org y para mutaciones críticas.
 */
export async function runInRls<T>(
  session: ResolvedSession,
  work: (tx: RlsTransaction | null) => Promise<T>,
): Promise<T> {
  if (session.organizationId === 0n) {
    const msg = `runInRls ejecutado sin organizationId (userId=${session.user.user_id}). Las mutaciones bajo RLS policy van a fallar silenciosamente.`;
    if (process.env.NODE_ENV !== "production") {
      throw new Error(`[runInRls] ${msg}`);
    }
    console.warn(`[runInRls] ${msg}`);
    return work(null);
  }
  return withTenantContext(
    {
      organizationId: session.organizationId,
      userId: session.user.user_id,
      isRoot: session.isRoot,
      bypassTenant: session.bypassTenant,
    },
    async () =>
      withRls(session.organizationId, { bypass: session.bypassTenant }, (tx) => work(tx)),
  );
}

/**
 * Lanza InsufficientPermissionsError si la sesión cargada no tiene `code`.
 * Útil cuando ya tienes la sesión y necesitas validar un permiso adicional
 * dentro de una rama del action.
 */
export function assertPermission(session: ResolvedSession, code: string): void {
  if (!session.user.permissionSet?.has(code)) {
    throw new InsufficientPermissionsError();
  }
}

export { AuthError, InsufficientPermissionsError };
