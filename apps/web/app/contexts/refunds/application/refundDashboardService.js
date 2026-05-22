/**
 * @module refundDashboardService
 * @description Use-case que arma el dashboard de reembolsos del usuario:
 *   - Saldo (wallet) del usuario.
 *   - Historial de solicitudes con monto reembolsable (suma de receipts
 *     donde refund=true y validation="Aprobado").
 *   - Warning si alguna solicitud excedió el plazo de comprobación.
 *
 * Réplica de la lógica que vivía inline en
 * `refundController.getRefundDashboardByUser` del backend legacy. Extraída
 * para invocación DI desde el loader de `/reembolso`.
 */
import {
  findUserWalletAndOrg,
  findUserRequestsWithReceipts,
} from "~/contexts/refunds/infrastructure/refundDashboardQueries.js";
import { isWithinDeadline } from "~/contexts/refunds/application/reimbursementTimeService.js";

/**
 * @typedef {object} RefundHistoryRow
 * @property {number} requestId
 * @property {Date|string|null} date
 * @property {number} amount         - suma de receipts.amount con refund=true y validation=Aprobado
 * @property {number} status         - requestStatusId
 * @property {Date|string|null} tripEndDate
 * @property {string|null} notes
 * @property {number} receiptCount
 *
 * @typedef {object} RefundDashboardData
 * @property {number} balance        - wallet del usuario
 * @property {RefundHistoryRow[]} history
 * @property {string|null} pendingDeadlineWarning
 */

/**
 * @param {number} userId
 * @returns {Promise<RefundDashboardData>}
 */
export async function getRefundDashboardForUser(userId) {
  const user = await findUserWalletAndOrg(userId);
  if (!user) {
    const err = new Error("Usuario no encontrado.");
    err.status = 404;
    throw err;
  }

  const requests = await findUserRequestsWithReceipts(userId);

  // Normaliza Date → ISO string (el componente espera strings porque venía
  // de apiRequest HTTP que serializa Date automáticamente).
  const toIso = (d) => (d instanceof Date ? d.toISOString() : d ?? null);

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

  let pendingDeadlineWarning = null;
  for (const r of requests) {
    if (!r.tripEndDate || !user.organizationId) continue;
    try {
      const within = await isWithinDeadline(r.requestId);
      if (!within) {
        pendingDeadlineWarning = `La solicitud #${r.requestId} excedió el plazo de comprobación.`;
        break;
      }
    } catch {
      /* ignore — failsafe */
    }
  }

  return {
    balance: Number(user.wallet ?? 0),
    history,
    pendingDeadlineWarning,
  };
}
