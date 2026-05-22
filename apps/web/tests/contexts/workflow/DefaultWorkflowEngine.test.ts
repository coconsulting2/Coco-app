/**
 * Smoke test del WorkflowEngine puro (sin DB). Verifica el rules engine
 * port-rewrite del legacy `workflowRulesEngine.js` (sesión M8 / sesión A).
 */
import { describe, it, expect } from "vitest";
import { DefaultWorkflowEngine } from "~/contexts/workflow/infrastructure/DefaultWorkflowEngine";
import type {
  ApproverResolution,
  EvaluationContext,
  WorkflowRule,
} from "~/contexts/workflow/domain/entities/WorkflowSnapshot";

const engine = new DefaultWorkflowEngine();

const baseCtx: EvaluationContext = {
  amount: 10000,
  currency: "MXN",
  destinationCountryIds: [1],
  receiptTypeIds: [],
  orgLevel: 1,
  departmentId: 1,
};

const approvers: ApproverResolution = {
  n1UserId: 100,
  n2UserId: 200,
  approverIds: [100, 200],
};

describe("DefaultWorkflowEngine", () => {
  it("initialStatusFromLevels: [1,2] → 2 (Primera Revisión)", () => {
    expect(engine.initialStatusFromLevels([1, 2])).toBe(2);
  });

  it("initialStatusFromLevels: [2] → 3 (Segunda Revisión)", () => {
    expect(engine.initialStatusFromLevels([2])).toBe(3);
  });

  it("statusAfterN1Approval: levels includes 2 → 3", () => {
    expect(engine.statusAfterN1Approval([1, 2])).toBe(3);
  });

  it("statusAfterN1Approval: no N2 → 4", () => {
    expect(engine.statusAfterN1Approval([1])).toBe(4);
  });

  it("statusAfterN2Approval: → 4", () => {
    expect(engine.statusAfterN2Approval()).toBe(4);
  });

  it("buildSnapshot: sin reglas pre → escala default 2 niveles", () => {
    const rules: WorkflowRule[] = [];
    const snap = engine.buildSnapshot(rules, baseCtx, "pre", approvers);
    expect(snap.levels).toEqual([1, 2]);
    expect(snap.n1UserId).toBe(100);
    expect(snap.n2UserId).toBe(200);
    expect(snap.skipApplied).toBe(false);
  });

  it("buildSnapshot: importe < skipIfBelow → skipApplied true, minTier=approvalLevel", () => {
    const rules: WorkflowRule[] = [
      {
        id: 1n,
        organizationId: 1n,
        ruleType: "pre",
        paramType: "importe",
        threshold: 50000,
        paramValue: null,
        approvalLevel: 2,
        skipIfBelow: 20000,
        priority: 0,
        active: true,
        departmentId: null,
        managerSteps: null,
        targetRole: null,
      },
    ];
    const snap = engine.buildSnapshot(rules, baseCtx, "pre", approvers);
    expect(snap.skipApplied).toBe(true);
    expect(snap.minApprovalLevel).toBe(2);
  });
});
