/**
 * @file legacy-js.d.ts
 * @description Declaraciones ambient para los `.js` legacy que sobreviven en
 * `apps/web/app/contexts/` y que aún no fueron convertidos a `.ts` con
 * hexagonal proper. Aquí los declaramos como `any` para que el slice's
 * `index.ts` pueda re-exportarlos sin necesidad de `// @ts-ignore`.
 *
 * Esta es deuda técnica explícita — cada slice convertido a hexagonal proper
 * (ej. `identity/`) elimina su entry aquí.
 *
 * Próximo en conversión: travel-requests, approvals sub-features,
 * accounts-payable, receipts-cfdi, policies, refunds, notifications,
 * onboarding, organizations, flights, hotels, travel-agency.
 * (workflow, fx, api-keys ya migrados 2026-05-22+)
 */

// ── cross-slice services legacy referenciados por approvals adapters ────
// (workflow, approvals sub-features ya migrados 2026-05-22+)
declare module "~/contexts/policies/application/policyExceptionService.js";
declare module "~/contexts/accounts-payable/application/anticipoPolizaLifecycleService.js";
declare module "~/contexts/onboarding/application/employeeHierarchyService.js";

// (receipts-cfdi ya migrado a TS 2026-05-22+; cfdi files con @ts-nocheck local)

// ── platform helpers (.js leftover) ───────────────────────────────────────
// Declarado vacío (TS lo trata con `any` implícito en accesos a propiedades)
// hasta que el archivo sea convertido a .ts hexagonal.
declare module "~/platform/permissions/permission-service.server.js";

declare module "~/platform/http/errors.server.js" {
  export class MissingTokenError extends Error {}
  export class ExpiredTokenError extends Error {}
  export class InvalidTokenError extends Error {}
  export class TokenMismatchError extends Error {}
  export class AuthError extends Error {}
  export class InsufficientPermissionsError extends Error {}
}

declare module "~/platform/mongo/gridfs.server.js" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const connectMongo: any;
}

declare module "~/platform/scheduler/index.js";
declare module "~/platform/scheduler/approval-substitute-cron.server.js";

declare module "~/platform/logger/log/logger.js" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const Logger: (name: string) => any;
}
