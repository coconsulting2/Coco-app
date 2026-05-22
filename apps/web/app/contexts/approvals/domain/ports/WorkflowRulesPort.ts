/**
 * @module WorkflowRulesPort
 * @description Port para resolver el próximo status después de una aprobación.
 * El adapter concreto vive en el slice `workflow/` (engine de reglas) —
 * `approvals` lo consume vía DI.
 */
export interface WorkflowRulesPort {
  statusAfterN1Approval(levels: number[]): number;
  statusAfterN2Approval(): number;
}
