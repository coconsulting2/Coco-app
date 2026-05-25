/**
 * @module refunds (slice public API)
 * @description Convertido a TS en sesión D — cero `@ts-ignore` aquí.
 * `applyRefundContext` ya importa `policies/policyService` (slice TS) sin
 * supresiones. El dispatcher `interface/api/refundsApi.server` mantiene un
 * `@ts-ignore` heredado en la ruta `/refunds/exceptions` (propiedad del lane
 * de policies / PolicyException, sesión H).
 */

export type { RefundRule } from "~/contexts/refunds/domain/entities/RefundRule.js";
export type { RefundRepository } from "~/contexts/refunds/domain/ports/RefundRepository.js";
export type { RefundEngine } from "~/contexts/refunds/domain/ports/RefundEngine.js";
export {
  RefundsError,
  RuleNotFoundError,
  InvalidRefundRuleError,
  DeadlineExceededError,
} from "~/contexts/refunds/domain/errors.js";

export {
  evaluateRefund,
  evaluateReceiptAgainstPolicy,
  buildPolicyEvaluationSnapshot,
  findApplicablePolicy,
  summarizeRequestPolicyResult,
  type CapBreach,
  type CapUnit,
  type DestinationScope,
  type ExpenseCapRow,
  type ReceiptEvaluationResult,
  type ReceiptInput,
  type TravelPolicyRow,
} from "~/contexts/refunds/application/refundRuleEngine.js";

export { applyRefundContextToRequest } from "~/contexts/refunds/application/applyRefundContext.js";

export {
  assertCanSubmitReceipts,
  computeRefundDeadline,
  computeDeadline,
  getOrgTimeLimit,
  setOrgTimeLimit,
  isWithinDeadline,
  lockExpiredRequests,
  RefundDeadlineExceededError,
  type OrgTimeLimit,
} from "~/contexts/refunds/application/reimbursementTimeService.js";

export {
  getRefundDashboardForUser,
  UserNotFoundError,
  type RefundDashboardData,
  type RefundHistoryRow,
} from "~/contexts/refunds/application/refundDashboardService.js";

// ── Plazo de comprobación (admin UI) — composition root hex ───────────────
export type {
  ReimbursementTimeRepository,
  ReimbursementTimeLimitRow,
  ReimbursementTimeLimitUpsert,
} from "~/contexts/refunds/domain/ports/ReimbursementTimeRepository.js";
export {
  InvalidRefundTimeLimitError,
  DEFAULT_DAYS_AFTER_TRIP,
  DEFAULT_GRACE_DAYS,
  DEFAULT_BLOCK_ON_EXPIRY,
  type RefundTimeLimit,
  type SetRefundTimeLimitInput,
  type ManageRefundTimeLimitDeps,
} from "~/contexts/refunds/application/manageRefundTimeLimit.js";

import * as manageRefundTimeLimitModule from "~/contexts/refunds/application/manageRefundTimeLimit.js";
import { PrismaReimbursementTimeRepository } from "~/contexts/refunds/infrastructure/PrismaReimbursementTimeRepository.js";

const defaultReimbursementTimeRepo = new PrismaReimbursementTimeRepository();

/** Use-case pre-wired: lee la config del plazo de comprobación de la org. */
export const getRefundTimeLimit = (organizationId: bigint | number) =>
  manageRefundTimeLimitModule.getRefundTimeLimit(organizationId, {
    timeRepo: defaultReimbursementTimeRepo,
  });

/** Use-case pre-wired: persiste la config del plazo de comprobación de la org. */
export const setRefundTimeLimit = (
  organizationId: bigint | number,
  input: manageRefundTimeLimitModule.SetRefundTimeLimitInput,
  updatedById: number | null,
) =>
  manageRefundTimeLimitModule.setRefundTimeLimit(organizationId, input, updatedById, {
    timeRepo: defaultReimbursementTimeRepo,
  });

/** Raw use-cases + adapter (para tests con stubs / composiciones custom). */
export const refundTimeLimitUsecases = {
  getRefundTimeLimit: manageRefundTimeLimitModule.getRefundTimeLimit,
  setRefundTimeLimit: manageRefundTimeLimitModule.setRefundTimeLimit,
} as const;

export { PrismaReimbursementTimeRepository } from "~/contexts/refunds/infrastructure/PrismaReimbursementTimeRepository.js";
