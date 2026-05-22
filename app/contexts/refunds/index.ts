/**
 * @module index
 * @description API pública del slice refunds.
 */

export type { RefundRule } from "~/contexts/refunds/domain/entities/RefundRule";
export type { RefundRepository } from "~/contexts/refunds/domain/ports/RefundRepository";
export type { RefundEngine } from "~/contexts/refunds/domain/ports/RefundEngine";
export { RefundsError, RuleNotFoundError, InvalidRefundRuleError, DeadlineExceededError } from "~/contexts/refunds/domain/errors";

// @ts-ignore — JS module
export { evaluateRefund, buildPolicyEvaluationSnapshot, findApplicablePolicy } from "~/contexts/refunds/application/refundRuleEngine.js";
// @ts-ignore — JS module
export { applyRefundContextToRequest } from "~/contexts/refunds/application/applyRefundContext.js";
// @ts-ignore — JS module
export { assertCanSubmitReceipts, computeRefundDeadline } from "~/contexts/refunds/application/reimbursementTimeService.js";
