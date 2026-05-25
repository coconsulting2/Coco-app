/**
 * @module RefundsExpenseDeadlineChecker
 * @description Adapter para el port `ExpenseDeadlineChecker`. Delega en
 * `isWithinDeadline(requestId)` del slice `refunds` (que aplica
 * `daysAfterTrip + graceDays` configurados por org).
 */
import { isWithinDeadline } from "~/contexts/refunds/index.js";
import type { ExpenseDeadlineChecker } from "~/contexts/receipts-cfdi/domain/ports/ExpenseDeadlineChecker.js";

export class RefundsExpenseDeadlineChecker implements ExpenseDeadlineChecker {
  async isWithinDeadline(requestId: number): Promise<boolean> {
    return isWithinDeadline(requestId);
  }
}
