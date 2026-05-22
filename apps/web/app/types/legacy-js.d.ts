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
 * Próximo en conversión: travel-requests, approvals, accounts-payable,
 * receipts-cfdi, policies, refunds, workflow, notifications, onboarding,
 * organizations, api-keys, fx, flights, hotels, travel-agency.
 */

// ── travel-requests ───────────────────────────────────────────────────────
declare module "~/contexts/travel-requests/application/applicantQueryService.js" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const listCompletedRequests: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const listActiveRequests: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const listDrafts: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const getRequestDetail: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const getCostCenterForUser: any;
}

declare module "~/contexts/travel-requests/application/applicantService.js" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const formatRoutes: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const getRequestDays: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const cancelTravelRequestValidation: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const createExpenseValidationBatch: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const sendReceiptsForValidation: any;
}

declare module "~/contexts/travel-requests/infrastructure/applicantModel.js" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Applicant: any;
  export default Applicant;
}

// ── approvals (legacy .js aún pendiente — substitute + resolver) ─────────

declare module "~/contexts/approvals/application/approverResolver.js" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const resolveN1N2Approvers: any;
}

declare module "~/contexts/approvals/application/approvalSubstituteService.js" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const upsertSubstitute: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const listSubstitutes: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const removeSubstitute: any;
}

declare module "~/contexts/approvals/application/alertMessageResolver.js" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const findAlertMessageIdForRequestStatus: any;
}

// ── cross-slice services legacy referenciados por approvals adapters ────
declare module "~/contexts/workflow/application/workflowRulesEngine.js";
declare module "~/contexts/policies/application/policyExceptionService.js";
declare module "~/contexts/accounts-payable/application/anticipoPolizaLifecycleService.js";
declare module "~/contexts/onboarding/application/employeeHierarchyService.js";

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
