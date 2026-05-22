/**
 * @module tenant-context.server (apps/web)
 * @description Re-export delgado de @coco/db para mantener compatibilidad con
 * los imports legacy `~/platform/db/tenant-context.server.js`. La implementación
 * vive en @coco/db (AsyncLocalStorage puro, sin acoplamiento web).
 *
 * `tenantContextMiddleware` es residual del backend Express legacy; en RR7 el
 * contexto se setea desde el loader/action vía `runInTenant` (apps/web/app/platform/session).
 */
export {
  withTenantContext,
  getTenantContext,
  tenantStorage,
  type TenantContext,
} from "@coco/db";
