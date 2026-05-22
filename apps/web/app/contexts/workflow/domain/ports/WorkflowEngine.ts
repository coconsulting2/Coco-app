/**
 * @module WorkflowEngine
 * @description Puerto del slice workflow. Es el rules engine PURO (sin DB)
 * que evalúa workflow_rules contra un contexto y produce un WorkflowSnapshot.
 *
 * El adapter default (`DefaultWorkflowEngine`) implementa la lógica que
 * vivía en `workflowRulesEngine.js` legacy.
 */
import type {
  ApproverResolution,
  EvaluationContext,
  RuleType,
  WorkflowRule,
  WorkflowSnapshot,
} from "~/contexts/workflow/domain/entities/WorkflowSnapshot.js";

export interface WorkflowEngine {
  /**
   * Evalúa reglas filtradas por `ruleType` contra `ctx`, anota approvers y
   * produce el snapshot que se persiste en `Request.workflowPreSnapshot` /
   * `Request.workflowPostSnapshot`.
   */
  buildSnapshot(
    rules: WorkflowRule[],
    ctx: EvaluationContext,
    ruleType: RuleType,
    approvers: ApproverResolution,
  ): WorkflowSnapshot;

  /** Estado inicial (`request_status_id`) a partir de los niveles del snapshot. */
  initialStatusFromLevels(levels: number[]): number;

  /** Estado tras aprobación N1 — depende de si hay nivel N2 pendiente. */
  statusAfterN1Approval(levels: number[]): number;

  /** Estado tras aprobación N2 — siempre transición a cotización. */
  statusAfterN2Approval(): number;
}
