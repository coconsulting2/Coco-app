/**
 * @module errors
 * @description Errores tipados del dominio del slice refunds.
 */
export class RefundsError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number = 400) {
    super(message);
    this.name = "RefundsError";
  }
}

export class RuleNotFoundError extends RefundsError {
  constructor(message?: string) { super(message ?? "RuleNotFoundError", "RULENOTFOUND"); }
}

export class InvalidRefundRuleError extends RefundsError {
  constructor(message?: string) { super(message ?? "InvalidRefundRuleError", "INVALIDREFUNDRULE"); }
}

export class DeadlineExceededError extends RefundsError {
  constructor(message?: string) { super(message ?? "DeadlineExceededError", "DEADLINEEXCEEDED"); }
}
