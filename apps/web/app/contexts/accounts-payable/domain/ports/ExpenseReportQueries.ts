/**
 * @module ExpenseReportQueries
 * @description Puerto de lectura del reporte de gastos por centro de costo
 * (dashboard M3-009 + reporte `gastos-por-centro`). El adapter concreto vive en
 * `infrastructure/` y envuelve la agregación Prisma legacy
 * (`buildExpensesByCostCenterReport` + `resolveExpenseReportVisibleUserIds`),
 * exponiéndola con una firma tipada.
 */

export type ReportPeriod = "monthly" | "quarterly";

export type ReportExpenseType =
  | "VIAJE_NACIONAL"
  | "VIAJE_INTERNACIONAL"
  | "HOSPEDAJE"
  | "TRANSPORTE"
  | "ALIMENTOS"
  | "OTROS";

export type ReportStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "paid";

export interface ExpenseReportRow {
  cost_center_id: number;
  cost_center_code: string;
  cost_center_name: string;
  period: string;
  amount: number;
  expense_type: ReportExpenseType;
  status: ReportStatus;
}

export interface CostCenterBudget {
  cost_center_id: number;
  cost_center_code: string;
  cost_center_name: string;
  budget: number;
  spent: number;
}

export interface ExpensesByCostCenterReport {
  generated_at: string;
  scope: "organization" | "team";
  team_member_count: number | null;
  rows: ExpenseReportRow[];
  budgets: CostCenterBudget[];
}

/** Filtros crudos (espejo del query string del reporte). */
export interface ExpenseReportQuery {
  period?: string;
  from?: string;
  to?: string;
  expenseType?: string[];
  status?: string[];
  costCenterId?: string[];
}

export interface ExpenseReportQueries {
  /**
   * Resuelve los user_id cuyos comprobantes puede ver el actor:
   * `null` = sin filtro (toda la organización).
   */
  resolveVisibleUserIds(
    actorUserId: number,
    permissionSet: Set<string> | undefined,
  ): Promise<number[] | null>;

  /** Agrega comprobantes por centro de costo y periodo para una organización. */
  buildExpensesByCostCenter(
    orgId: number,
    query: ExpenseReportQuery,
    options: { visibleUserIds: number[] | null },
  ): Promise<ExpensesByCostCenterReport>;
}
