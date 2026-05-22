/**
 * @module DefaultWorkflowEngine
 * @description Adapter por defecto del puerto `WorkflowEngine`. Lógica pura
 * sin DB — port-rewrite del legacy `workflowRulesEngine.js` con tipado
 * estricto.
 */
import type { WorkflowEngine } from "~/contexts/workflow/domain/ports/WorkflowEngine.js";
import type {
  ApproverResolution,
  EvaluationContext,
  RuleType,
  WorkflowRule,
  WorkflowSnapshot,
} from "~/contexts/workflow/domain/entities/WorkflowSnapshot.js";

function num(v: number | null | undefined): number {
  if (v === null || v === undefined) return Number.NaN;
  return Number(v);
}

function ruleMatches(rule: WorkflowRule, ctx: EvaluationContext): boolean {
  const cur = (ctx.currency || "MXN").trim().toUpperCase();
  switch (rule.paramType) {
    case "importe":
      return rule.threshold !== null && num(rule.threshold) >= ctx.amount;
    case "moneda":
      return (rule.paramValue || "").trim().toUpperCase() === cur;
    case "destino": {
      const want = Number(rule.paramValue);
      const ids = ctx.destinationCountryIds || [];
      return ids.some((id) => Number(id) === want);
    }
    case "gasto": {
      const want = Number(rule.paramValue);
      const ids = ctx.receiptTypeIds || [];
      return ids.some((id) => Number(id) === want);
    }
    case "nivel":
      return (
        ctx.orgLevel !== null &&
        ctx.orgLevel !== undefined &&
        String(ctx.orgLevel) === String(rule.paramValue || "").trim()
      );
    default:
      return false;
  }
}

function maxLevelFromImporteBands(
  amount: number,
  importeRules: WorkflowRule[],
): number {
  const candidates = importeRules
    .filter((r) => r.threshold !== null && amount <= num(r.threshold))
    .sort((a, b) => num(a.threshold) - num(b.threshold));
  if (candidates.length === 0) return 2;
  return candidates[0]!.approvalLevel;
}

type LevelsResult = {
  maxLevel: number;
  minTier: number;
  skipApplied: boolean;
  levels: number[];
  targetRole: string | null;
};

function computeLevelsFromRules(
  rules: WorkflowRule[],
  ctx: EvaluationContext,
  ruleType: RuleType,
): LevelsResult {
  const scoped = rules.filter(
    (r) =>
      r.ruleType === ruleType &&
      r.active &&
      (!r.departmentId || r.departmentId === ctx.departmentId),
  );

  const importeRules = scoped.filter((r) => r.paramType === "importe");
  let maxLevel = maxLevelFromImporteBands(ctx.amount, importeRules);

  const other = scoped.filter((r) => r.paramType !== "importe");
  for (const r of other) {
    if (ruleMatches(r, ctx)) {
      maxLevel = Math.max(maxLevel, r.approvalLevel);
    }
  }

  let maxManagerSteps = 0;
  for (const r of scoped) {
    if (r.managerSteps) {
      maxManagerSteps = Math.max(maxManagerSteps, r.managerSteps);
    }
  }

  if (maxManagerSteps > 0) {
    maxLevel = Math.max(maxLevel, maxManagerSteps);
  } else {
    maxLevel = Math.min(2, Math.max(1, maxLevel));
  }

  let minTier = 1;
  let skipApplied = false;
  for (const r of scoped) {
    if (r.skipIfBelow !== null && ctx.amount < num(r.skipIfBelow)) {
      skipApplied = true;
      minTier = Math.max(minTier, r.approvalLevel);
    }
  }

  maxLevel = Math.max(maxLevel, minTier);

  const levels: number[] = [];
  for (let L = minTier; L <= maxLevel; L++) levels.push(L);

  let targetRole: string | null = null;
  for (const r of scoped) {
    if (r.targetRole) targetRole = r.targetRole;
  }

  return { maxLevel, minTier, skipApplied, levels, targetRole };
}

export class DefaultWorkflowEngine implements WorkflowEngine {
  buildSnapshot(
    rules: WorkflowRule[],
    ctx: EvaluationContext,
    ruleType: RuleType,
    approvers: ApproverResolution,
  ): WorkflowSnapshot {
    const { maxLevel, minTier, skipApplied, levels, targetRole } =
      computeLevelsFromRules(rules, ctx, ruleType);
    const currency = (ctx.currency || "MXN").trim().toUpperCase();

    return {
      ruleType,
      levels,
      approvers: levels.map(
        (l) => (approvers.approverIds && approvers.approverIds[l - 1]) ?? null,
      ),
      n1UserId: levels.includes(1)
        ? approvers.n1UserId ?? approvers.approverIds?.[0] ?? null
        : null,
      n2UserId: levels.includes(2)
        ? approvers.n2UserId ?? approvers.approverIds?.[1] ?? null
        : null,
      skipApplied,
      amountEvaluated: ctx.amount,
      currencyEvaluated: currency,
      maxApprovalLevel: maxLevel,
      minApprovalLevel: minTier,
      targetRole,
    };
  }

  initialStatusFromLevels(levels: number[]): number {
    if (!levels.length) return 2;
    const head = Math.min(...levels);
    if (head === 1) return 2;
    if (head === 2) return 3;
    return 2;
  }

  statusAfterN1Approval(levels: number[]): number {
    return levels.includes(2) ? 3 : 4;
  }

  statusAfterN2Approval(): number {
    return 4;
  }
}
