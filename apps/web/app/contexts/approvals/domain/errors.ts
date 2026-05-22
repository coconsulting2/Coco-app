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

export class RequestNotInAuthorizationStatusError extends ApprovalsError {
  constructor() {
    super("Request is not awaiting N1/N2 authorization at this status", "BAD_STATUS", 400);
  }
}

export class AmountExceedsLimitNoEscalationError extends ApprovalsError {
  constructor() {
    super(
      "El monto supera el tope de aprobación y no hay un nivel superior configurado para escalar.",
      "AMOUNT_EXCEEDS_NO_ESCALATION",
      409,
    );
  }
}

export class AmountExceedsTopLimitError extends ApprovalsError {
  constructor() {
    super(
      "El monto supera el tope de aprobación de este nivel y no hay más niveles configurados.",
      "AMOUNT_EXCEEDS_TOP",
      409,
    );
  }
}

export class PendingPolicyExceptionsError extends ApprovalsError {
  constructor() {
    super(
      "Resuelva las excepciones de política pendientes antes de aprobar la solicitud.",
      "PENDING_POLICY_EXCEPTIONS",
      409,
    );
  }
}

export class RejectionReasonRequiredError extends ApprovalsError {
  constructor() {
    super("El comentario es obligatorio para rechazar la solicitud", "REASON_REQUIRED", 400);
  }
}

export class ReassignmentTargetInvalidError extends ApprovalsError {
  constructor(message: string) {
    super(message, "REASSIGN_TARGET_INVALID", 400);
  }
}
