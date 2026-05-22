/**
 * @module reimbursementTimeService
 * @description Plazo configurable de comprobación de gastos (M2-006 RF-37, RF-39).
 *   Default 14 días desde Request.tripEndDate. blockOnExpiry controla si
 *   `assertCanSubmitReceipts` y el cron `refundDeadlineJob` bloquean al vencer.
 *
 * Refactor Fase 6: prisma extraído a reimbursementTimeQueries.js.
 */
import {
  findTimeLimitByOrg,
  upsertTimeLimit,
  findRequestForDeadline,
  findExpiredCandidates,
  lockRequestAutomatic,
} from "~/contexts/refunds/infrastructure/reimbursementTimeQueries.js";

const DEFAULT_DAYS_AFTER_TRIP = 14;
const DEFAULT_GRACE_DAYS = 0;
const DEFAULT_BLOCK_ON_EXPIRY = true;

const TERMINAL_STATUS_IDS = [8, 9, 10]; // Finalizado, Cancelado, Rechazado

/**
 * @returns {{ daysAfterTrip: number, graceDays: number, blockOnExpiry: boolean, active: boolean }}
 */
function defaultLimit() {
  return {
    daysAfterTrip: DEFAULT_DAYS_AFTER_TRIP,
    graceDays: DEFAULT_GRACE_DAYS,
    blockOnExpiry: DEFAULT_BLOCK_ON_EXPIRY,
    active: true,
  };
}

/**
 * @param {bigint | number} organizationId
 * @returns {Promise<{ daysAfterTrip: number, graceDays: number, blockOnExpiry: boolean, active: boolean }>}
 */
export async function getOrgTimeLimit(organizationId) {
  const row = await findTimeLimitByOrg(organizationId);
  if (!row) return defaultLimit();
  return {
    daysAfterTrip: row.daysAfterTrip,
    graceDays: row.graceDays,
    blockOnExpiry: row.blockOnExpiry,
    active: row.active,
  };
}

/**
 * @param {bigint | number} organizationId
 * @param {{ daysAfterTrip?: number, graceDays?: number, blockOnExpiry?: boolean, active?: boolean }} payload
 * @param {number | null} [updatedById]
 */
export async function setOrgTimeLimit(organizationId, payload, updatedById = null) {
  const data = {
    daysAfterTrip: payload.daysAfterTrip ?? DEFAULT_DAYS_AFTER_TRIP,
    graceDays: payload.graceDays ?? DEFAULT_GRACE_DAYS,
    blockOnExpiry: payload.blockOnExpiry ?? DEFAULT_BLOCK_ON_EXPIRY,
    active: payload.active ?? true,
    updatedById,
  };
  return upsertTimeLimit(organizationId, data);
}

/**
 * @param {Date | string} tripEndDate
 * @param {bigint | number} organizationId
 * @returns {Promise<{ deadline: Date, gracePeriodEnd: Date, daysAfterTrip: number, graceDays: number }>}
 */
export async function computeDeadline(tripEndDate, organizationId) {
  const limit = await getOrgTimeLimit(organizationId);
  const base = tripEndDate instanceof Date ? new Date(tripEndDate) : new Date(tripEndDate);

  const deadline = new Date(base);
  deadline.setUTCDate(deadline.getUTCDate() + limit.daysAfterTrip);
  deadline.setUTCHours(23, 59, 59, 999);

  const gracePeriodEnd = new Date(deadline);
  if (limit.graceDays > 0) {
    gracePeriodEnd.setUTCDate(gracePeriodEnd.getUTCDate() + limit.graceDays);
  }

  return { deadline, gracePeriodEnd, daysAfterTrip: limit.daysAfterTrip, graceDays: limit.graceDays };
}

/**
 * @param {number} requestId
 * @returns {Promise<boolean>}
 */
export async function isWithinDeadline(requestId) {
  const req = await findRequestForDeadline(requestId);
  if (!req || !req.tripEndDate || !req.user || !req.user.organizationId) return true;

  const { gracePeriodEnd } = await computeDeadline(req.tripEndDate, req.user.organizationId);
  return new Date() <= gracePeriodEnd;
}

/**
 * @param {number} requestId
 * @throws {{ status: number, message: string }}
 */
export async function assertCanSubmitReceipts(requestId) {
  const req = await findRequestForDeadline(requestId);
  if (!req || !req.tripEndDate || !req.user || !req.user.organizationId) return;

  const limit = await getOrgTimeLimit(req.user.organizationId);
  if (!limit.blockOnExpiry) return;

  const { gracePeriodEnd, daysAfterTrip } = await computeDeadline(
    req.tripEndDate,
    req.user.organizationId,
  );
  if (new Date() > gracePeriodEnd) {
    const err = new Error(
      `Plazo de reembolso vencido (${daysAfterTrip} días desde fin de viaje). ` +
        "Solicite extensión al administrador para continuar.",
    );
    err.status = 403;
    throw err;
  }
}

/**
 * @returns {Promise<{ scanned: number, locked: number }>}
 */
export async function lockExpiredRequests() {
  const candidates = await findExpiredCandidates(TERMINAL_STATUS_IDS);

  let locked = 0;
  for (const req of candidates) {
    if (!req.user || !req.user.organizationId || !req.tripEndDate) continue;
    const limit = await getOrgTimeLimit(req.user.organizationId);
    if (!limit.blockOnExpiry) continue;

    const { gracePeriodEnd, daysAfterTrip } = await computeDeadline(
      req.tripEndDate,
      req.user.organizationId,
    );
    if (new Date() <= gracePeriodEnd) continue;

    await lockRequestAutomatic(
      req.requestId,
      req.user.userId,
      `Cierre automático por plazo de reembolso vencido (${daysAfterTrip} días desde fin de viaje).`,
    );
    locked += 1;
  }

  return { scanned: candidates.length, locked };
}
