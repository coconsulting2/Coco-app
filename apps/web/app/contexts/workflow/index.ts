/**
 * @module index
 * @description API pública del slice workflow.
 */

export type { WorkflowSnapshot } from "~/contexts/workflow/domain/entities/WorkflowSnapshot";
export type { WorkflowRuleRepository } from "~/contexts/workflow/domain/ports/WorkflowRuleRepository";
export type { WorkflowEngine } from "~/contexts/workflow/domain/ports/WorkflowEngine";
export { WorkflowError, WorkflowRuleNotFoundError, InvalidWorkflowConfigError, EscalationDeadlineMissedError } from "~/contexts/workflow/domain/errors";

// @ts-ignore — JS module
export { buildSnapshot, initialStatusFromLevels } from "~/contexts/workflow/application/workflowRulesEngine.js";
// @ts-ignore — JS module
export { buildRequestWorkflowSnapshots } from "~/contexts/workflow/application/buildRequestWorkflowSnapshots.js";
// @ts-ignore — JS module
export { addComment, listComments, deleteComment } from "~/contexts/workflow/application/requestCommentService.js";
