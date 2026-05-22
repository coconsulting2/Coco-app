/**
 * @module refundDashboardService
 * @description Use-case que arma el dashboard de reembolsos del usuario.
 */
import {
  findUserWalletAndOrg,
  findUserRequestsWithReceipts,
} from "~/contexts/refunds/infrastructure/refundDashboardQueries.js";
import { isWithinDeadline } from "~/contexts/refunds/application/reimbursementTimeService.js";

export type RefundHistoryRow = {
  requestId: number;
  date: string | null;
  amount: number;
  status: number;
  tripEndDate: string | null;
  notes: string | null;
  receiptCount: number;
};

export type RefundDashboardData = {
  balance: number;
  history: RefundHistoryRow[];
  pendingDeadlineWarning: string | null;
};

export class UserNotFoundError extends Error {
  readonly code = "USERNOTFOUND";
  readonly status = 404;
  constructor() {
    super("Usuario no encontrado.");
    this.name = "UserNotFoundError";
  }
}

function toIso(d: Date | string | null | undefined): string | null {
  if (d === null || d === undefined) return null;
  return d instanceof Date ? d.toISOString() : d;
}

export async function getRefundDashboardForUser(
  userId: number,
): Promise<RefundDashboardData> {
  const user = await findUserWalletAndOrg(userId);
  if (!user) throw new UserNotFoundError();

  const requests = await findUserRequestsWithReceipts(userId);

  const history = requests.map((r) => {
    const totalRefundable = r.receipts
      .filter((rc) => rc.refund && rc.validation === "Aprobado")
      .reduce((acc, rc) => acc + Number(rc.amount), 0);
    return {
      requestId: r.requestId,
      date: toIso(r.creationDate),
      amount: totalRefundable,
      status: r.requestStatusId,
      tripEndDate: toIso(r.tripEndDate),
      notes: r.notes,
      receiptCount: r.receipts.length,
    };
  });

  let pendingDeadlineWarning: string | null = null;
  for (const r of requests) {
    if (!r.tripEndDate || !user.organizationId) continue;
    try {
      const within = await isWithinDeadline(r.requestId);
      if (!within) {
        pendingDeadlineWarning = `La solicitud #${r.requestId} excedió el plazo de comprobación.`;
        break;
      }
    } catch {
      /* ignore */
    }
  }

  return {
    balance: Number(user.wallet ?? 0),
    history,
    pendingDeadlineWarning,
  };
}
