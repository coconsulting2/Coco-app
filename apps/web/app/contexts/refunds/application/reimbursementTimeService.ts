/**
 * @module reimbursementTimeService
 * @description Plazo configurable de comprobación de gastos (M2-006 RF-37, RF-39).
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

const TERMINAL_STATUS_IDS = [8, 9, 10];

export type OrgTimeLimit = {
  daysAfterTrip: number;
  graceDays: number;
  blockOnExpiry: boolean;
  active: boolean;
};

function defaultLimit(): OrgTimeLimit {
  return {
    daysAfterTrip: DEFAULT_DAYS_AFTER_TRIP,
    graceDays: DEFAULT_GRACE_DAYS,
    blockOnExpiry: DEFAULT_BLOCK_ON_EXPIRY,
    active: true,
  };
}

export async function getOrgTimeLimit(
  organizationId: bigint | number,
): Promise<OrgTimeLimit> {
  const row = (await findTimeLimitByOrg(organizationId)) as
    | (OrgTimeLimit & Record<string, unknown>)
    | null;
  if (!row) return defaultLimit();
  return {
    daysAfterTrip: row.daysAfterTrip,
    graceDays: row.graceDays,
    blockOnExpiry: row.blockOnExpiry,
    active: row.active,
  };
}

export async function setOrgTimeLimit(
  organizationId: bigint | number,
  payload: Partial<OrgTimeLimit>,
  updatedById: number | null = null,
): Promise<unknown> {
  const data = {
    daysAfterTrip: payload.daysAfterTrip ?? DEFAULT_DAYS_AFTER_TRIP,
    graceDays: payload.graceDays ?? DEFAULT_GRACE_DAYS,
    blockOnExpiry: payload.blockOnExpiry ?? DEFAULT_BLOCK_ON_EXPIRY,
    active: payload.active ?? true,
    updatedById,
  };
  return upsertTimeLimit(organizationId, data);
}

export async function computeDeadline(
  tripEndDate: Date | string,
  organizationId: bigint | number,
): Promise<{
  deadline: Date;
  gracePeriodEnd: Date;
  daysAfterTrip: number;
  graceDays: number;
}> {
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

type RequestForDeadline = {
  requestId: number;
  tripEndDate: Date | null;
  user?: { organizationId: bigint | null; userId?: number } | null;
};

export async function isWithinDeadline(requestId: number): Promise<boolean> {
  const req = (await findRequestForDeadline(requestId)) as RequestForDeadline | null;
  if (!req || !req.tripEndDate || !req.user || !req.user.organizationId) return true;
  const { gracePeriodEnd } = await computeDeadline(req.tripEndDate, req.user.organizationId);
  return new Date() <= gracePeriodEnd;
}

export class RefundDeadlineExceededError extends Error {
  readonly code = "REFUNDDEADLINEEXCEEDED";
  readonly status = 403;
  constructor(message: string) {
    super(message);
    this.name = "RefundDeadlineExceededError";
  }
}

export async function assertCanSubmitReceipts(requestId: number): Promise<void> {
  const req = (await findRequestForDeadline(requestId)) as RequestForDeadline | null;
  if (!req || !req.tripEndDate || !req.user || !req.user.organizationId) return;

  const limit = await getOrgTimeLimit(req.user.organizationId);
  if (!limit.blockOnExpiry) return;

  const { gracePeriodEnd, daysAfterTrip } = await computeDeadline(
    req.tripEndDate,
    req.user.organizationId,
  );
  if (new Date() > gracePeriodEnd) {
    throw new RefundDeadlineExceededError(
      `Plazo de reembolso vencido (${daysAfterTrip} días desde fin de viaje). ` +
        "Solicite extensión al administrador para continuar.",
    );
  }
}

type ExpiredCandidate = RequestForDeadline & {
  user: { organizationId: bigint; userId: number };
};

export async function lockExpiredRequests(): Promise<{ scanned: number; locked: number }> {
  const candidates = (await findExpiredCandidates(TERMINAL_STATUS_IDS)) as ExpiredCandidate[];

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
      req.user.organizationId,
      `Cierre automático por plazo de reembolso vencido (${daysAfterTrip} días desde fin de viaje).`,
    );
    locked += 1;
  }

  return { scanned: candidates.length, locked };
}

export const computeRefundDeadline = computeDeadline;
