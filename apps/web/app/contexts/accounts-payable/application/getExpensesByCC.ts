/**
 * @module getExpensesByCC
 * @description Use-case puro con DI: reporte de gastos por centro de costo
 * (dashboard M3-009 + reporte tabular `gastos-por-centro`). Réplica del
 * controller legacy `expenseReportController.getExpensesByCostCenter`:
 *   - resuelve los usuarios visibles según permisos del actor (org-wide vs.
 *     subordinados vs. propios),
 *   - delega la agregación Prisma al port `ExpenseReportQueries`.
 */
import type {
  ExpenseReportQueries,
  ExpenseReportQuery,
  ExpensesByCostCenterReport,
} from "~/contexts/accounts-payable/domain/ports/ExpenseReportQueries";
import { InvalidAccountingDataError } from "~/contexts/accounts-payable/domain/errors";

export interface GetExpensesByCCInput {
  orgId: number;
  actorUserId: number;
  permissionSet?: Set<string>;
  query?: ExpenseReportQuery;
}

export type GetExpensesByCCDeps = { expenseReportQueries: ExpenseReportQueries };

export async function getExpensesByCC(
  input: GetExpensesByCCInput,
  deps: GetExpensesByCCDeps,
): Promise<ExpensesByCostCenterReport> {
  if (!Number.isFinite(input.orgId)) {
    throw new InvalidAccountingDataError(
      "No hay organización en contexto. Inicia sesión de nuevo o elige una organización (impersonación).",
    );
  }

  const visibleUserIds = await deps.expenseReportQueries.resolveVisibleUserIds(
    input.actorUserId,
    input.permissionSet,
  );

  return deps.expenseReportQueries.buildExpensesByCostCenter(
    input.orgId,
    input.query ?? {},
    { visibleUserIds },
  );
}
