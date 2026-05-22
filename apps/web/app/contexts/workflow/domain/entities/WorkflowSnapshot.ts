/**
 * @module WorkflowSnapshot
 * @description Entidad de dominio del slice workflow. Tipos puros — los
 * mappers en `infrastructure/` traducen entre Prisma y este shape.
 */

export type RuleType = "pre" | "post";

export type ParamType = "importe" | "nivel" | "gasto" | "destino" | "moneda";

export type WorkflowRule = {
  id: bigint;
  organizationId: bigint;
  ruleType: string;
  paramType: string;
  threshold: number | null;
  paramValue: string | null;
  approvalLevel: number;
  skipIfBelow: number | null;
  priority: number;
  active: boolean;
  departmentId: number | null;
  managerSteps: number | null;
  targetRole: string | null;
};

export type EvaluationContext = {
  amount: number;
  currency?: string;
  destinationCountryIds?: number[];
  receiptTypeIds?: number[];
  orgLevel?: number | null;
  departmentId?: number | null;
};

export type ApproverResolution = {
  n1UserId: number | null;
  n2UserId: number | null;
  approverIds: Array<number | null>;
};

export type WorkflowSnapshot = {
  ruleType: RuleType;
  levels: number[];
  approvers: Array<number | null>;
  n1UserId: number | null;
  n2UserId: number | null;
  skipApplied: boolean;
  amountEvaluated: number;
  currencyEvaluated: string;
  maxApprovalLevel: number;
  minApprovalLevel: number;
  targetRole: string | null;
};
