/**
 * @module refundRuleEngine
 * @description Motor puro de evaluación de políticas de reembolso (M2-006).
 * Recibe estructuras planas (sin Prisma) y produce decisiones
 * { exceeded, excess, snapshot } que el caller persiste o muestra en UI.
 */

export type CapUnit = "per_night" | "per_trip" | "per_day" | "per_event";
export type DestinationScope = "nacional" | "internacional" | "any";

export type ExpenseCapRow = {
  capId: number;
  policyId: number;
  receiptTypeId: number;
  capAmount: number | string | { toNumber(): number };
  capUnit: CapUnit;
  currency: string;
};

export type TravelPolicyRow = {
  policyId: number;
  organizationId: bigint | number;
  name: string;
  categoryId: number | null;
  destinationScope: DestinationScope;
  costsCenter: string | null;
  dailyPerDiem: number | string | { toNumber(): number } | null;
  currency: string;
  validFrom: Date | string;
  validTo: Date | string | null;
  active: boolean;
};

export type ReceiptInput = {
  receiptId?: number;
  receiptTypeId: number;
  amount: number;
  currency?: string;
  nights?: number;
  days?: number;
};

export type ApplicabilityCtx = {
  categoryId?: number | null;
  destinationScope: DestinationScope;
  costsCenter?: string | null;
  evaluationDate?: Date | string;
};

export type CapBreach = {
  capId: number;
  receiptTypeId: number;
  capUnit: CapUnit;
  capAmount: number;
  unitAmount: number;
  excess: number;
  excessTotal: number;
  currency: string;
};

export type ReceiptEvaluationResult = {
  ok: boolean;
  exceeded: boolean;
  excessByCap: CapBreach[];
  snapshot: {
    policyId: number | null;
    evaluatedAt: string;
    receiptTypeId: number;
    amount: number;
    currency: string;
  };
};

function num(v: unknown): number {
  if (v === null || v === undefined) return NaN;
  if (typeof v === "number") return v;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "object" && v !== null && "toNumber" in v && typeof (v as { toNumber: () => number }).toNumber === "function") {
    return (v as { toNumber: () => number }).toNumber();
  }
  return Number(v);
}

function toDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}

export function findApplicablePolicy(
  policies: TravelPolicyRow[],
  ctx: ApplicabilityCtx,
): TravelPolicyRow | null {
  if (!Array.isArray(policies) || policies.length === 0) return null;
  const evaluationDate = ctx.evaluationDate ? toDate(ctx.evaluationDate) : new Date();
  const wantedScope = ctx.destinationScope;

  const scored: Array<{ policy: TravelPolicyRow; score: number }> = [];
  for (const p of policies) {
    if (!p.active) continue;

    const from = toDate(p.validFrom);
    if (from > evaluationDate) continue;
    if (p.validTo) {
      const to = toDate(p.validTo);
      if (to < evaluationDate) continue;
    }

    const scopeOk = p.destinationScope === "any" || p.destinationScope === wantedScope;
    if (!scopeOk) continue;

    const categoryMatch =
      p.categoryId !== null &&
      p.categoryId !== undefined &&
      ctx.categoryId !== null &&
      ctx.categoryId !== undefined &&
      Number(p.categoryId) === Number(ctx.categoryId);
    const costMatch =
      p.costsCenter !== null &&
      p.costsCenter !== undefined &&
      ctx.costsCenter !== null &&
      ctx.costsCenter !== undefined &&
      String(p.costsCenter).trim() === String(ctx.costsCenter).trim();
    const catchAll =
      (p.categoryId === null || p.categoryId === undefined) &&
      (p.costsCenter === null || p.costsCenter === undefined);

    let score = 0;
    if (categoryMatch && costMatch) score = 4;
    else if (categoryMatch) score = 3;
    else if (costMatch) score = 2;
    else if (catchAll) score = 1;
    else continue;

    scored.push({ policy: p, score });
  }

  if (scored.length === 0) return null;

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return toDate(b.policy.validFrom).getTime() - toDate(a.policy.validFrom).getTime();
  });

  return scored[0]!.policy;
}

function unitAmountFor(amount: number, capUnit: CapUnit, receipt: ReceiptInput): number {
  switch (capUnit) {
    case "per_night": {
      const nights = Math.max(1, Number(receipt.nights ?? 1));
      return amount / nights;
    }
    case "per_day": {
      const days = Math.max(1, Number(receipt.days ?? 1));
      return amount / days;
    }
    case "per_trip":
    case "per_event":
    default:
      return amount;
  }
}

function unitsCount(capUnit: CapUnit, receipt: ReceiptInput): number {
  if (capUnit === "per_night") return Math.max(1, Number(receipt.nights ?? 1));
  if (capUnit === "per_day") return Math.max(1, Number(receipt.days ?? 1));
  return 1;
}

export function evaluateReceiptAgainstPolicy(
  receipt: ReceiptInput,
  caps: ExpenseCapRow[],
  policy: TravelPolicyRow | null,
): ReceiptEvaluationResult {
  const amount = Number(receipt.amount);
  const currency = (receipt.currency ?? policy?.currency ?? "MXN").toUpperCase();
  const evaluatedAt = new Date().toISOString();

  if (!policy) {
    return {
      ok: true,
      exceeded: false,
      excessByCap: [],
      snapshot: { policyId: null, evaluatedAt, receiptTypeId: receipt.receiptTypeId, amount, currency },
    };
  }

  const relevantCaps = (caps ?? []).filter(
    (c) =>
      Number(c.policyId) === Number(policy.policyId) &&
      Number(c.receiptTypeId) === Number(receipt.receiptTypeId),
  );

  if (relevantCaps.length === 0) {
    return {
      ok: true,
      exceeded: false,
      excessByCap: [],
      snapshot: { policyId: policy.policyId, evaluatedAt, receiptTypeId: receipt.receiptTypeId, amount, currency },
    };
  }

  const excessByCap = relevantCaps.map((cap) => {
    const capAmount = num(cap.capAmount);
    const unitAmount = unitAmountFor(amount, cap.capUnit, receipt);
    const units = unitsCount(cap.capUnit, receipt);
    const excessUnit = unitAmount > capAmount ? unitAmount - capAmount : 0;
    const excessTotal = excessUnit * units;
    return {
      capId: cap.capId,
      receiptTypeId: cap.receiptTypeId,
      capUnit: cap.capUnit,
      capAmount,
      unitAmount,
      excess: excessUnit,
      excessTotal,
      currency: cap.currency,
    };
  });

  const exceeded = excessByCap.some((b) => b.excess > 0);

  return {
    ok: !exceeded,
    exceeded,
    excessByCap,
    snapshot: { policyId: policy.policyId, evaluatedAt, receiptTypeId: receipt.receiptTypeId, amount, currency },
  };
}

export function summarizeRequestPolicyResult(
  receipts: ReceiptInput[],
  caps: ExpenseCapRow[],
  policy: TravelPolicyRow | null,
  opts: { approvedExceptionReceiptIds?: number[]; perDiemDays?: number } = {},
): {
  totalClaimed: number;
  totalAllowed: number;
  totalExcess: number;
  currency: string;
  perReceipt: Array<{
    receiptId: number | undefined;
    amount: number;
    allowed: number;
    excess: number;
    exceeded: boolean;
    hadExceptionApproved: boolean;
  }>;
} {
  const approvedSet = new Set((opts.approvedExceptionReceiptIds ?? []).map(Number));
  const currency = (policy?.currency ?? "MXN").toUpperCase();

  let totalClaimed = 0;
  let totalAllowed = 0;
  let totalExcess = 0;
  const perReceipt: Array<{
    receiptId: number | undefined;
    amount: number;
    allowed: number;
    excess: number;
    exceeded: boolean;
    hadExceptionApproved: boolean;
  }> = [];

  for (const r of receipts ?? []) {
    const amount = Number(r.amount);
    totalClaimed += amount;

    const hadExceptionApproved =
      r.receiptId !== undefined && approvedSet.has(Number(r.receiptId));
    if (hadExceptionApproved) {
      totalAllowed += amount;
      perReceipt.push({ receiptId: r.receiptId, amount, allowed: amount, excess: 0, exceeded: false, hadExceptionApproved: true });
      continue;
    }

    const result = evaluateReceiptAgainstPolicy(r, caps, policy);
    const excessTotal = result.excessByCap.reduce((acc, b) => acc + b.excessTotal, 0);
    const allowed = Math.max(0, amount - excessTotal);

    totalAllowed += allowed;
    totalExcess += excessTotal;
    perReceipt.push({ receiptId: r.receiptId, amount, allowed, excess: excessTotal, exceeded: result.exceeded, hadExceptionApproved: false });
  }

  return { totalClaimed, totalAllowed, totalExcess, currency, perReceipt };
}

export function buildPolicyEvaluationSnapshot(
  policy: TravelPolicyRow | null,
  caps: ExpenseCapRow[],
  requestCtx: { organizationId?: bigint | number; requestId?: number; evaluationDate?: Date | string } = {},
): object | null {
  if (!policy) return null;
  const evaluatedAt = (requestCtx.evaluationDate
    ? toDate(requestCtx.evaluationDate)
    : new Date()
  ).toISOString();

  const frozenCaps = (caps ?? [])
    .filter((c) => Number(c.policyId) === Number(policy.policyId))
    .map((c) => ({
      capId: c.capId,
      receiptTypeId: c.receiptTypeId,
      capAmount: num(c.capAmount),
      capUnit: c.capUnit,
      currency: c.currency,
    }));

  return {
    policyId: policy.policyId,
    name: policy.name,
    categoryId: policy.categoryId,
    destinationScope: policy.destinationScope,
    costsCenter: policy.costsCenter,
    dailyPerDiem:
      policy.dailyPerDiem !== null && policy.dailyPerDiem !== undefined
        ? num(policy.dailyPerDiem)
        : null,
    currency: policy.currency,
    validFrom: toDate(policy.validFrom).toISOString(),
    validTo: policy.validTo ? toDate(policy.validTo).toISOString() : null,
    caps: frozenCaps,
    evaluatedAt,
    requestId: requestCtx.requestId ?? null,
  };
}

/** Alias usado por index.ts legacy. */
export const evaluateRefund = evaluateReceiptAgainstPolicy;
