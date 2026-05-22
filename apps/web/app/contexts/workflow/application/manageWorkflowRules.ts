/**
 * @module manageWorkflowRules
 * @description Use-cases CRUD para workflow_rules (admin UI). Deps por DI.
 */
import type {
  WorkflowRuleInput,
  WorkflowRuleRepository,
} from "~/contexts/workflow/domain/ports/WorkflowRuleRepository.js";
import type { WorkflowRule } from "~/contexts/workflow/domain/entities/WorkflowSnapshot.js";
import { WorkflowRuleNotFoundError } from "~/contexts/workflow/domain/errors.js";

export type ManageRulesDeps = { rules: WorkflowRuleRepository };

export async function listRules(
  organizationId: bigint,
  deps: ManageRulesDeps,
): Promise<WorkflowRule[]> {
  return deps.rules.listRules(organizationId);
}

export async function getRule(
  id: bigint | number,
  deps: ManageRulesDeps,
): Promise<WorkflowRule> {
  const row = await deps.rules.getRule(id);
  if (!row) throw new WorkflowRuleNotFoundError();
  return row;
}

export async function createRule(
  input: WorkflowRuleInput,
  deps: ManageRulesDeps,
): Promise<WorkflowRule> {
  return deps.rules.createRule(input);
}

export async function updateRule(
  id: bigint | number,
  patch: Partial<WorkflowRuleInput>,
  deps: ManageRulesDeps,
): Promise<WorkflowRule> {
  return deps.rules.updateRule(id, patch);
}
