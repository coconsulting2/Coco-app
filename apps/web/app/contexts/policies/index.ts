/**
 * @module index
 * @description API pública del slice policies.
 */

export type { TravelPolicy } from "~/contexts/policies/domain/entities/TravelPolicy";
export type { PolicyRepository } from "~/contexts/policies/domain/ports/PolicyRepository";
export type { PolicyEngine } from "~/contexts/policies/domain/ports/PolicyEngine";
export { PoliciesError, PolicyNotFoundError, PolicyViolationError, InvalidPolicyCapsError } from "~/contexts/policies/domain/errors";

// ── Tipos de dominio compartidos del slice ──────────────────────────────
export type {
  TravelPolicyRow,
  ExpenseCapRow,
  ExpenseCapInput,
  PolicyPayload,
  ListPoliciesFilters,
  EmployeeCategoryRow,
  CategoryPayload,
  PolicyExceptionRow,
  ViaticosPolicyRow,
  ViaticosPolicyPayload,
} from "~/contexts/policies/domain/types";

// ── Use-cases: políticas (CRUD + snapshot) ──────────────────────────────
export {
  listPolicies,
  getPolicy,
  createPolicy,
  updatePolicy,
  deactivatePolicy,
  setExpenseCaps,
  snapshotPolicyForRequest,
} from "~/contexts/policies/application/policyService.js";

// ── Use-cases: alerta/preview de receipt contra política ────────────────
// `previewReceipt` y `raisePolicyAlert` son alias de `checkReceiptBeforeSubmit`.
export {
  checkReceiptBeforeSubmit,
  previewReceipt,
  raisePolicyAlert,
} from "~/contexts/policies/application/policyAlertService.js";
export type {
  CheckReceiptInput,
  CheckReceiptResult,
} from "~/contexts/policies/application/policyAlertService.js";

// ── Use-cases: excepciones de política ──────────────────────────────────
// `requestException`/`approveException` son alias de `createException`/`decideException`.
export {
  createException,
  decideException,
  listPendingForRequest,
  listPendingForApprover,
  listExceptions,
  requestException,
  approveException,
} from "~/contexts/policies/application/policyExceptionService";
export type {
  CreateExceptionPayload,
  ExceptionDecision,
} from "~/contexts/policies/application/policyExceptionService";

// ── Use-cases: política de viáticos ─────────────────────────────────────
export {
  getViaticosPolicy,
  setViaticosPolicy,
  checkFeeVsViaticosPolicy,
} from "~/contexts/policies/application/viaticasPolicyService.js";

// ── Use-cases: categorías de empleado ───────────────────────────────────
export {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deactivateCategory,
} from "~/contexts/policies/application/employeeCategoryService.js";

// ── Hexagonal use-case: previewExpensePolicy (RF-44) ─────────────────────
export type {
  ExpensePolicyPreviewQueries,
  ActivePolicyWithCaps,
  RequestPreviewContext,
  PreviewRouteLeg,
  PolicyEvaluationSnapshot,
  FrozenSnapshotCap,
} from "~/contexts/policies/domain/ports/ExpensePolicyPreviewQueries";
export { PrismaExpensePolicyPreviewQueries } from "~/contexts/policies/infrastructure/PrismaExpensePolicyPreviewQueries";

import { PrismaExpensePolicyPreviewQueries } from "~/contexts/policies/infrastructure/PrismaExpensePolicyPreviewQueries";
import {
  previewExpensePolicy as previewExpensePolicyRaw,
  type PreviewExpensePolicyInput,
} from "~/contexts/policies/application/previewExpensePolicy";

const defaultExpensePolicyPreviewQueries = new PrismaExpensePolicyPreviewQueries();

/**
 * Use-case pre-wireado: preview de política de gasto contra la solicitud.
 * Paridad 1:1 con el legacy `POST /policies/preview`. Consúmelo desde una
 * action RR7 dentro de `runInTenant`.
 */
export const previewExpensePolicy = (input: PreviewExpensePolicyInput) =>
  previewExpensePolicyRaw(input, { queries: defaultExpensePolicyPreviewQueries });

export { previewExpensePolicyRaw };
export type {
  PreviewExpensePolicyInput,
  PreviewExpensePolicyResult,
  PreviewExpensePolicyDeps,
} from "~/contexts/policies/application/previewExpensePolicy";
