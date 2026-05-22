/**
 * @module refunds (slice public API)
 * @description Convertido a TS en sesión D — cero `@ts-ignore` aquí.
 * `applyRefundContext` mantiene un `@ts-ignore` local apuntando a
 * `policies/policyService.js` mientras ese slice se migra (sesión H).
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
