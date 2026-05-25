/**
 * Unit tests de los use-cases CRUD/toggle de workflow rules con stub in-memory
 * del port `WorkflowRuleRepository` — sin DB. Cubre list/get/create/update y el
 * nuevo `toggleRule` (scoped a la organización).
 */
import { describe, it, expect, vi } from "vitest";
import {
  listRules,
  getRule,
  createRule,
  updateRule,
  toggleRule,
} from "~/contexts/workflow/application/manageWorkflowRules";
import { WorkflowRuleNotFoundError } from "~/contexts/workflow/domain/errors";
import type {
  WorkflowRuleInput,
  WorkflowRuleRepository,
} from "~/contexts/workflow/domain/ports/WorkflowRuleRepository";
import type { WorkflowRule } from "~/contexts/workflow/domain/entities/WorkflowSnapshot";

function makeRule(over: Partial<WorkflowRule> = {}): WorkflowRule {
  return {
    id: 1n,
    organizationId: 101n,
    ruleType: "pre",
    paramType: "importe",
    threshold: 50000,
    paramValue: null,
    approvalLevel: 1,
    skipIfBelow: null,
    priority: 10,
    active: true,
    departmentId: null,
    managerSteps: null,
    targetRole: null,
    ...over,
  };
}

function makeRepo(
  over: Partial<WorkflowRuleRepository> = {},
): WorkflowRuleRepository {
  return {
    listActiveRulesForOrg: async () => [],
    listRules: async () => [makeRule()],
    getRule: async () => makeRule(),
    createRule: async (input: WorkflowRuleInput) =>
      makeRule({ organizationId: input.organizationId }),
    updateRule: async () => makeRule(),
    toggleRule: async () => makeRule({ active: false }),
    ...over,
  };
}

describe("manageWorkflowRules", () => {
  it("listRules delega en el port con el orgId", async () => {
    const listRulesSpy = vi.fn(async () => [makeRule()]);
    const out = await listRules(101n, { rules: makeRepo({ listRules: listRulesSpy }) });
    expect(listRulesSpy).toHaveBeenCalledWith(101n);
    expect(out).toHaveLength(1);
  });

  it("getRule lanza WorkflowRuleNotFoundError si no existe", async () => {
    await expect(
      getRule(99, { rules: makeRepo({ getRule: async () => null }) }),
    ).rejects.toBeInstanceOf(WorkflowRuleNotFoundError);
  });

  it("createRule pasa el input al port", async () => {
    const createSpy = vi.fn(async (i: WorkflowRuleInput) => makeRule({ organizationId: i.organizationId }));
    const input: WorkflowRuleInput = {
      organizationId: 202n,
      ruleType: "pre",
      paramType: "importe",
      approvalLevel: 1,
    };
    await createRule(input, { rules: makeRepo({ createRule: createSpy }) });
    expect(createSpy).toHaveBeenCalledWith(input);
  });

  it("updateRule reenvía id + patch al port", async () => {
    const updateSpy = vi.fn(async () => makeRule());
    await updateRule(5, { priority: 3 }, { rules: makeRepo({ updateRule: updateSpy }) });
    expect(updateSpy).toHaveBeenCalledWith(5, { priority: 3 });
  });

  it("toggleRule reenvía id + organizationId al port", async () => {
    const toggleSpy = vi.fn(async () => makeRule({ active: false }));
    const out = await toggleRule(7, 101n, { rules: makeRepo({ toggleRule: toggleSpy }) });
    expect(toggleSpy).toHaveBeenCalledWith(7, 101n);
    expect(out.active).toBe(false);
  });
});
