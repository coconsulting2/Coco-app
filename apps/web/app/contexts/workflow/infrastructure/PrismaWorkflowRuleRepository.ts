/**
 * @module PrismaWorkflowRuleRepository
 * @description Adapter Prisma del puerto `WorkflowRuleRepository`. ÚNICO sitio
 * del slice acoplado a Prisma vía `~/platform/db/prisma.server`.
 */
import prisma from "~/platform/db/prisma.server.js";
import type {
  WorkflowRuleInput,
  WorkflowRuleRepository,
  TransactionLike,
} from "~/contexts/workflow/domain/ports/WorkflowRuleRepository.js";
import type { WorkflowRule } from "~/contexts/workflow/domain/entities/WorkflowSnapshot.js";
import { WorkflowRuleNotFoundError } from "~/contexts/workflow/domain/errors.js";

type PrismaRuleRow = {
  id: bigint;
  organizationId: bigint;
  ruleType: string;
  paramType: string;
  threshold: { toString(): string } | null;
  paramValue: string | null;
  approvalLevel: number;
  skipIfBelow: { toString(): string } | null;
  priority: number;
  active: boolean;
  departmentId: number | null;
  managerSteps: number | null;
  targetRole: string | null;
};

function mapRow(row: PrismaRuleRow): WorkflowRule {
  return {
    id: row.id,
    organizationId: row.organizationId,
    ruleType: row.ruleType,
    paramType: row.paramType,
    threshold: row.threshold === null ? null : Number(row.threshold.toString()),
    paramValue: row.paramValue,
    approvalLevel: row.approvalLevel,
    skipIfBelow: row.skipIfBelow === null ? null : Number(row.skipIfBelow.toString()),
    priority: row.priority,
    active: row.active,
    departmentId: row.departmentId,
    managerSteps: row.managerSteps,
    targetRole: row.targetRole,
  };
}

type PrismaLike = {
  workflowRule: {
    findMany(args: unknown): Promise<PrismaRuleRow[]>;
    findUnique(args: unknown): Promise<PrismaRuleRow | null>;
    create(args: unknown): Promise<PrismaRuleRow>;
    update(args: unknown): Promise<PrismaRuleRow>;
  };
};

function pickClient(tx: TransactionLike | null): PrismaLike {
  return (tx ?? prisma) as unknown as PrismaLike;
}

export class PrismaWorkflowRuleRepository implements WorkflowRuleRepository {
  async listActiveRulesForOrg(
    tx: TransactionLike | null,
    organizationId: bigint,
  ): Promise<WorkflowRule[]> {
    const rows = await pickClient(tx).workflowRule.findMany({
      where: { organizationId, active: true },
    });
    return rows.map(mapRow);
  }

  async listRules(organizationId: bigint): Promise<WorkflowRule[]> {
    const rows = await prisma.workflowRule.findMany({
      where: { organizationId },
      orderBy: [{ priority: "desc" }, { id: "asc" }],
    });
    return rows.map(mapRow as (r: PrismaRuleRow) => WorkflowRule);
  }

  async getRule(id: bigint | number): Promise<WorkflowRule | null> {
    const row = await prisma.workflowRule.findUnique({
      where: { id: typeof id === "bigint" ? id : BigInt(id) },
    });
    return row ? mapRow(row) : null;
  }

  async createRule(input: WorkflowRuleInput): Promise<WorkflowRule> {
    const row = await prisma.workflowRule.create({
      data: {
        organizationId: input.organizationId,
        ruleType: input.ruleType,
        paramType: input.paramType,
        threshold: input.threshold ?? null,
        paramValue: input.paramValue ?? null,
        approvalLevel: input.approvalLevel,
        skipIfBelow: input.skipIfBelow ?? null,
        priority: input.priority ?? 0,
        active: input.active ?? true,
        departmentId: input.departmentId ?? null,
        managerSteps: input.managerSteps ?? null,
        targetRole: input.targetRole ?? null,
      },
    });
    return mapRow(row);
  }

  async updateRule(
    id: bigint | number,
    patch: Partial<WorkflowRuleInput>,
  ): Promise<WorkflowRule> {
    const where = { id: typeof id === "bigint" ? id : BigInt(id) };
    try {
      const row = await prisma.workflowRule.update({
        where,
        data: {
          ruleType: patch.ruleType,
          paramType: patch.paramType,
          threshold: patch.threshold,
          paramValue: patch.paramValue,
          approvalLevel: patch.approvalLevel,
          skipIfBelow: patch.skipIfBelow,
          priority: patch.priority,
          active: patch.active,
          departmentId: patch.departmentId,
          managerSteps: patch.managerSteps,
          targetRole: patch.targetRole,
        },
      });
      return mapRow(row);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "P2025") throw new WorkflowRuleNotFoundError();
      throw err;
    }
  }
}
