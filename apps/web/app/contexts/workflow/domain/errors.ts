/**
 * @module errors
 * @description Errores tipados del dominio del slice workflow.
 */
export class WorkflowError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number = 400) {
    super(message);
    this.name = "WorkflowError";
  }
}

export class WorkflowRuleNotFoundError extends WorkflowError {
  constructor(message?: string) { super(message ?? "WorkflowRuleNotFoundError", "WORKFLOWRULENOTFOUND"); }
}

export class InvalidWorkflowConfigError extends WorkflowError {
  constructor(message?: string) { super(message ?? "InvalidWorkflowConfigError", "INVALIDWORKFLOWCONFIG"); }
}

export class EscalationDeadlineMissedError extends WorkflowError {
  constructor(message?: string) { super(message ?? "EscalationDeadlineMissedError", "ESCALATIONDEADLINEMISSED"); }
}

export class RequestCommentInvalidActorError extends WorkflowError {
  constructor(message?: string) {
    super(message ?? "Invalid user or request id for comment", "REQUESTCOMMENTINVALIDACTOR", 400);
  }
}

export class RequestCommentCursorTamperedError extends WorkflowError {
  constructor(message?: string) {
    super(message ?? "Tampered comment cursor", "REQUESTCOMMENTCURSORTAMPERED", 400);
  }
}
