/**
 * @module policyService
 * @description CRUD de políticas de viáticos + caps + snapshot al envío de
 * solicitud (M2-006 RF-42, RF-43, RF-46). Lógica de negocio pura: recibe el
 * puerto de queries por DI (default pre-wireado al adapter Prisma).
 */
import {
  buildPolicyEvaluationSnapshot,
  findApplicablePolicy,
  type TravelPolicyRow as EngineTravelPolicyRow,
  type ExpenseCapRow as EngineExpenseCapRow,
} from "~/contexts/refunds/application/refundRuleEngine.js";
import { prismaPolicyQueries } from "~/contexts/policies/infrastructure/policyQueries.js";
import type {
  OverlapCheck,
  PolicyQueriesPort,
  PolicyTxClient,
} from "~/contexts/policies/domain/ports/PolicyQueriesPort";
import {
  httpError,
  type DestinationScope,
  type ExpenseCapInput,
  type ListPoliciesFilters,
  type PolicyData,
  type PolicyPayload,
  type TravelPolicyRow,
} from "~/contexts/policies/domain/types";

const VALID_DESTINATION_SCOPES: DestinationScope[] = ["nacional", "internacional", "any"];
const VALID_CAP_UNITS = ["per_night", "per_trip", "per_day", "per_event"];

export interface PolicyServiceDeps {
  queries: PolicyQueriesPort;
}

const defaultDeps: PolicyServiceDeps = { queries: prismaPolicyQueries };

function ensureScope(scope: string): asserts scope is DestinationScope {
  if (!VALID_DESTINATION_SCOPES.includes(scope as DestinationScope)) {
    throw httpError(`destinationScope inválido: ${scope}`, 400);
  }
}

function ensureCapUnit(unit: string): void {
  if (!VALID_CAP_UNITS.includes(unit)) {
    throw httpError(`capUnit inválido: ${unit}`, 400);
  }
}

function ensureValidDates(
  validFrom: Date | string | undefined | null,
  validTo: Date | string | undefined | null,
): void {
  if (!validFrom) {
    throw httpError("validFrom requerido.", 400);
  }
  if (validTo) {
    const from = new Date(validFrom);
    const to = new Date(validTo);
    if (from > to) {
      throw httpError("validFrom debe ser <= validTo.", 400);
    }
  }
}

/**
 * Helper de overlap reutilizable por createPolicyWithCapsTx +
 * updatePolicyWithCapsTx. Recibe `tx` (cliente Prisma o transacción).
 */
const hasOverlap: OverlapCheck = async (tx, payload, excludePolicyId = null) => {
  const where: Record<string, unknown> = {
    organizationId: payload.organizationId,
    categoryId: payload.categoryId ?? null,
    destinationScope: payload.destinationScope,
    costsCenter: payload.costsCenter ?? null,
    active: true,
  };
  if (excludePolicyId !== null && excludePolicyId !== undefined) {
    where.NOT = { policyId: Number(excludePolicyId) };
  }

  const candidates = await (tx as PolicyTxClient).travelPolicy.findMany({ where });
  const reqFrom = new Date(payload.validFrom);
  const reqTo = payload.validTo ? new Date(payload.validTo) : null;

  return candidates.some((p) => {
    const pFrom = new Date(p.validFrom);
    const pTo = p.validTo ? new Date(p.validTo) : null;
    if (reqTo && reqTo < pFrom) return false;
    if (pTo && reqFrom > pTo) return false;
    return true;
  });
};

/** Lists travel policies for an org with optional filters. */
export async function listPolicies(
  organizationId: bigint | number,
  filters: ListPoliciesFilters = {},
  deps: PolicyServiceDeps = defaultDeps,
): Promise<TravelPolicyRow[]> {
  const where: Record<string, unknown> = { organizationId };
  if (filters.activeOnly !== false) where.active = true;
  if (filters.categoryId !== undefined && filters.categoryId !== null) {
    where.categoryId = Number(filters.categoryId);
  }
  if (filters.asOfDate) {
    const date = new Date(filters.asOfDate);
    where.validFrom = { lte: date };
    where.OR = [{ validTo: null }, { validTo: { gte: date } }];
  }
  return deps.queries.listPoliciesWith(where);
}

/** Reads one policy with its caps, scoped to org. */
export async function getPolicy(
  policyId: number,
  organizationId: bigint | number,
  deps: PolicyServiceDeps = defaultDeps,
): Promise<TravelPolicyRow | null> {
  const row = await deps.queries.findPolicyById(policyId);
  if (!row || String(row.organizationId) !== String(organizationId)) return null;
  return row;
}

/** Creates a new policy with its caps. */
export async function createPolicy(
  organizationId: bigint | number,
  payload: PolicyPayload,
  deps: PolicyServiceDeps = defaultDeps,
): Promise<TravelPolicyRow> {
  const scope = (payload.destinationScope || "any") as DestinationScope;
  ensureScope(scope);
  ensureValidDates(payload.validFrom, payload.validTo);
  for (const c of payload.caps || []) ensureCapUnit(c.capUnit);

  const policyData: PolicyData = {
    organizationId,
    name: String(payload.name).trim(),
    categoryId: payload.categoryId ?? null,
    destinationScope: scope,
    costsCenter: payload.costsCenter ? String(payload.costsCenter).trim() : null,
    dailyPerDiem: payload.dailyPerDiem ?? null,
    currency: payload.currency || "MXN",
    validFrom: new Date(payload.validFrom as Date | string),
    validTo: payload.validTo ? new Date(payload.validTo) : null,
    active: true,
  };

  return deps.queries.createPolicyWithCapsTx(policyData, payload.caps || [], hasOverlap);
}

/**
 * Updates a policy. Caps are replaced atomically (idempotent setExpenseCaps
 * semantics).
 */
export async function updatePolicy(
  policyId: number,
  organizationId: bigint | number,
  payload: PolicyPayload,
  deps: PolicyServiceDeps = defaultDeps,
): Promise<TravelPolicyRow> {
  const existing = await getPolicy(policyId, organizationId, deps);
  if (!existing) {
    throw httpError(`Política ${policyId} no encontrada.`, 404);
  }
  if (payload.destinationScope) ensureScope(payload.destinationScope);
  if (payload.validFrom || payload.validTo) {
    ensureValidDates(
      payload.validFrom ?? existing.validFrom,
      payload.validTo ?? existing.validTo,
    );
  }
  for (const c of payload.caps || []) ensureCapUnit(c.capUnit);

  const data: Record<string, unknown> = {};
  if (payload.name !== undefined) data.name = String(payload.name).trim();
  if (payload.categoryId !== undefined) data.categoryId = payload.categoryId;
  if (payload.destinationScope !== undefined) data.destinationScope = payload.destinationScope;
  if (payload.costsCenter !== undefined)
    data.costsCenter = payload.costsCenter ? String(payload.costsCenter).trim() : null;
  if (payload.dailyPerDiem !== undefined) data.dailyPerDiem = payload.dailyPerDiem;
  if (payload.currency !== undefined) data.currency = payload.currency;
  if (payload.validFrom !== undefined) data.validFrom = new Date(payload.validFrom);
  if (payload.validTo !== undefined) data.validTo = payload.validTo ? new Date(payload.validTo) : null;
  if (payload.active !== undefined) data.active = Boolean(payload.active);

  const checkPayload = { ...existing, ...data, organizationId };
  return deps.queries.updatePolicyWithCapsTx(
    policyId,
    data,
    payload.caps,
    deps.queries.setExpenseCapsInTx,
    checkPayload,
    hasOverlap,
  );
}

/** Soft-deletes (active=false). Idempotent. */
export async function deactivatePolicy(
  policyId: number,
  organizationId: bigint | number,
  deps: PolicyServiceDeps = defaultDeps,
): Promise<TravelPolicyRow> {
  const existing = await getPolicy(policyId, organizationId, deps);
  if (!existing) {
    throw httpError(`Política ${policyId} no encontrada.`, 404);
  }
  return deps.queries.updatePolicyRow(policyId, { active: false });
}

/** Idempotent replacement of expense caps for a policy. */
export async function setExpenseCaps(
  policyId: number,
  organizationId: bigint | number,
  caps: ExpenseCapInput[],
  deps: PolicyServiceDeps = defaultDeps,
): Promise<TravelPolicyRow> {
  const existing = await getPolicy(policyId, organizationId, deps);
  if (!existing) {
    throw httpError(`Política ${policyId} no encontrada.`, 404);
  }
  for (const c of caps) ensureCapUnit(c.capUnit);
  return deps.queries.replaceExpenseCapsTx(policyId, caps);
}

export interface SnapshotContext {
  destinationScope: DestinationScope;
  categoryId?: number | null;
  costsCenter?: string | null;
}

/**
 * Resolves the applicable policy for a request and its evaluation context,
 * then freezes it into Request.policyEvaluationSnapshot.
 */
export async function snapshotPolicyForRequest(
  tx: unknown,
  requestId: number,
  ctx: SnapshotContext,
  deps: PolicyServiceDeps = defaultDeps,
): Promise<{ policyId: number | null; snapshot: unknown }> {
  const { orgId, policies } = await deps.queries.findPoliciesForRequestSnapshot(tx, requestId);
  if (!orgId) return { policyId: null, snapshot: null };

  const policy = findApplicablePolicy(policies as unknown as EngineTravelPolicyRow[], {
    categoryId: ctx.categoryId ?? null,
    destinationScope: ctx.destinationScope,
    costsCenter: ctx.costsCenter ?? null,
    evaluationDate: new Date(),
  });
  const caps: EngineExpenseCapRow[] = policy
    ? ((policy as { expenseCaps?: EngineExpenseCapRow[] }).expenseCaps ?? [])
    : [];
  const snapshot = buildPolicyEvaluationSnapshot(policy, caps, {
    requestId,
    organizationId: orgId,
  });

  await deps.queries.updateRequestSnapshot(tx, requestId, snapshot);

  return { policyId: policy ? policy.policyId : null, snapshot };
}
