/**
 * @module @coco/db/tenant
 * @description AsyncLocalStorage para multi-tenant context. Provee primitivas
 * puras (sin acoplamiento con Express/RR7/Sesiones): `withTenantContext`,
 * `getTenantContext`. La composición con sesiones HTTP se hace en apps/web
 * (`runInTenant`).
 */
import { AsyncLocalStorage } from "node:async_hooks";

export type TenantContext = {
  /** organizationId activo (post-impersonate). BigInt para tipos Prisma. */
  organizationId: bigint;
  /** organizationId original del JWT. */
  jwtOrgId: bigint;
  /** user_id del JWT, o null en jobs internos. */
  userId: number | null;
  /** true si el JWT viene de la org ROOT (Ditta). */
  isRoot: boolean;
  /** true si el super-admin pidió bypass cross-tenant. */
  bypassTenant: boolean;
};

const storage = new AsyncLocalStorage<TenantContext>();

/** Devuelve el contexto activo o null si no hay tenant scope. */
export function getTenantContext(): TenantContext | null {
  return storage.getStore() ?? null;
}

/**
 * Ejecuta una función dentro de un tenant context explícito. Útil para jobs/cron,
 * seeds, scripts CLI, e impersonación interna desde super-admin.
 */
export function withTenantContext<T>(
  ctx: {
    organizationId: bigint | number | string;
    userId?: number | null;
    isRoot?: boolean;
    bypassTenant?: boolean;
  },
  fn: () => Promise<T>,
): Promise<T> {
  const orgId = BigInt(ctx.organizationId);
  const resolved: TenantContext = {
    organizationId: orgId,
    jwtOrgId: orgId,
    userId: ctx.userId ?? null,
    isRoot: Boolean(ctx.isRoot),
    bypassTenant: Boolean(ctx.bypassTenant),
  };
  return storage.run(resolved, fn);
}

export const tenantStorage = storage;
