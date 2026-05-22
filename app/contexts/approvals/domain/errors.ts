/**
 * @module errors
 * @description Errores tipados del dominio del slice approvals.
 */
export class ApprovalsError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number = 400) {
    super(message);
    this.name = "ApprovalsError";
  }
}

export class ApprovalNotFoundError extends ApprovalsError {
  constructor(message?: string) { super(message ?? "ApprovalNotFoundError", "APPROVALNOTFOUND"); }
}

export class AlreadyDecidedError extends ApprovalsError {
  constructor(message?: string) { super(message ?? "AlreadyDecidedError", "ALREADYDECIDED"); }
}

export class NotAuthorizedToApproveError extends ApprovalsError {
  constructor(message?: string) { super(message ?? "NotAuthorizedToApproveError", "NOTAUTHORIZEDTOAPPROVE"); }
}
