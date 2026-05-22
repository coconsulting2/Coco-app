/**
 * @module WorkflowRuleRepository
 * @description Puerto del slice workflow. Las queries Prisma viven en
 * `infrastructure/PrismaWorkflowRuleRepository.ts`. Los use-cases consumen
 * ESTE contrato — nunca Prisma directo.
 */
import type { WorkflowRule } from "~/contexts/workflow/domain/entities/WorkflowSnapshot.js";

export type WorkflowRuleInput = {
  organizationId: bigint;
  ruleType: string;
  paramType: string;
  threshold?: number | null;
  paramValue?: string | null;
  approvalLevel: number;
  skipIfBelow?: number | null;
  priority?: number;
  active?: boolean;
  departmentId?: number | null;
  managerSteps?: number | null;
  targetRole?: string | null;
};

/**
 * Handle de transacción Prisma — usamos `unknown` para no propagar el tipo
 * `Prisma.TransactionClient` al port (que es dominio puro). Los adapters
 * castean internamente.
 */
export type TransactionLike = unknown;

export interface WorkflowRuleRepository {
  /** Reglas activas para una organización dentro de una transacción dada. */
  listActiveRulesForOrg(
    tx: TransactionLike | null,
    organizationId: bigint,
  ): Promise<WorkflowRule[]>;

  /** Lista reglas para admin UI. */
  listRules(organizationId: bigint): Promise<WorkflowRule[]>;

  /** Lee una regla por id. */
  getRule(id: bigint | number): Promise<WorkflowRule | null>;

  /** Crea una regla. */
  createRule(input: WorkflowRuleInput): Promise<WorkflowRule>;

  /** Actualiza una regla. */
  updateRule(
    id: bigint | number,
    patch: Partial<WorkflowRuleInput>,
  ): Promise<WorkflowRule>;
}
