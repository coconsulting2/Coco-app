/**
 * @module ExpenseDeadlineChecker
 * @description Puerto para consultar si una solicitud aún está dentro del
 * plazo configurado para comprobar gastos. El adapter por defecto wrappea
 * el slice `refunds` (`reimbursementTimeService.isWithinDeadline`).
 */
export interface ExpenseDeadlineChecker {
  isWithinDeadline(requestId: number): Promise<boolean>;
}
