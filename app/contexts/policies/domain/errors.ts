/**
 * @module errors
 * @description Errores tipados del dominio del slice policies.
 */
export class PoliciesError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number = 400) {
    super(message);
    this.name = "PoliciesError";
  }
}

export class PolicyNotFoundError extends PoliciesError {
  constructor(message?: string) { super(message ?? "PolicyNotFoundError", "POLICYNOTFOUND"); }
}

export class PolicyViolationError extends PoliciesError {
  constructor(message?: string) { super(message ?? "PolicyViolationError", "POLICYVIOLATION"); }
}

export class InvalidPolicyCapsError extends PoliciesError {
  constructor(message?: string) { super(message ?? "InvalidPolicyCapsError", "INVALIDPOLICYCAPS"); }
}
