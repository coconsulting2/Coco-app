// @ts-nocheck — bulk-converted legacy; typed properly is M9 follow-up
/**
 * @module policyService
 * @description CRUD de políticas de viáticos + caps + snapshot al envío de
 * solicitud (M2-006 RF-42, RF-43, RF-46).
 *
 * Refactor Fase 6: prisma extraído a policyQueries.js. Los helpers
 * transaccionales (overlap check, setExpenseCapsInTx) ahora reciben `tx` por
 * parámetro y viven en infrastructure/.
 */
import {
  buildPolicyEvaluationSnapshot,
  findApplicablePolicy,
} from "~/contexts/refunds/application/refundRuleEngine.js";
import {
  listPoliciesWith,
  findPolicyById,
  updatePolicyRow,
  createPolicyWithCapsTx,
  updatePolicyWithCapsTx,
  setExpenseCapsInTx,
  replaceExpenseCapsTx,
  findPoliciesForRequestSnapshot,
  updateRequestSnapshot,
} from "~/contexts/policies/infrastructure/policyQueries.js";

const VALID_DESTINATION_SCOPES = ["nacional", "internacional", "any"];
const VALID_CAP_UNITS = ["per_night", "per_trip", "per_day", "per_event"];

function ensureScope(scope) {
  if (!VALID_DESTINATION_SCOPES.includes(scope)) {
    const err = new Error(`destinationScope inválido: ${scope}`);
    err.status = 400;
    throw err;
  }
}

function ensureCapUnit(unit) {
  if (!VALID_CAP_UNITS.includes(unit)) {
    const err = new Error(`capUnit inválido: ${unit}`);
    err.status = 400;
    throw err;
  }
}

function ensureValidDates(validFrom, validTo) {
  if (!validFrom) {
    const err = new Error("validFrom requerido.");
    err.status = 400;
    throw err;
  }
  if (validTo) {
    const from = new Date(validFrom);
    const to = new Date(validTo);
    if (from > to) {
      const err = new Error("validFrom debe ser <= validTo.");
      err.status = 400;
      throw err;
    }
  }
}

/**
 * Helper de overlap reutilizable por createPolicyWithCapsTx + updatePolicyWithCapsTx.
 * Recibe `tx` (cliente Prisma o transacción).
 */
async function hasOverlap(tx, payload, excludePolicyId = null) {
  const where = {
    organizationId: payload.organizationId,
    categoryId: payload.categoryId ?? null,
    destinationScope: payload.destinationScope,
    costsCenter: payload.costsCenter ?? null,
    active: true,
  };
  if (excludePolicyId !== null) where.NOT = { policyId: Number(excludePolicyId) };

  const candidates = await tx.travelPolicy.findMany({ where });
  const reqFrom = new Date(payload.validFrom);
  const reqTo = payload.validTo ? new Date(payload.validTo) : null;

  return candidates.some((p) => {
    const pFrom = new Date(p.validFrom);
    const pTo = p.validTo ? new Date(p.validTo) : null;
    if (reqTo && reqTo < pFrom) return false;
    if (pTo && reqFrom > pTo) return false;
    return true;
  });
}

/**
 * Lists travel policies for an org with optional filters.
 *
 * @param {bigint | number} organizationId
 * @param {{ activeOnly?: boolean, categoryId?: number, asOfDate?: Date | string }} [filters]
 */
export async function listPolicies(organizationId, filters = {}) {
  const where = { organizationId };
  if (filters.activeOnly !== false) where.active = true;
  if (filters.categoryId !== undefined && filters.categoryId !== null) {
    where.categoryId = Number(filters.categoryId);
  }
  if (filters.asOfDate) {
    const date = new Date(filters.asOfDate);
    where.validFrom = { lte: date };
    where.OR = [{ validTo: null }, { validTo: { gte: date } }];
  }
  return listPoliciesWith(where);
}

/**
 * Reads one policy with its caps, scoped to org.
 *
 * @param {number} policyId
 * @param {bigint | number} organizationId
 */
export async function getPolicy(policyId, organizationId) {
  const row = await findPolicyById(policyId);
  if (!row || String(row.organizationId) !== String(organizationId)) return null;
  return row;
}

/**
 * Creates a new policy with its caps.
 *
 * @param {bigint | number} organizationId
 * @param {object} payload
 */
export async function createPolicy(organizationId, payload) {
  const scope = payload.destinationScope || "any";
  ensureScope(scope);
  ensureValidDates(payload.validFrom, payload.validTo);
  for (const c of payload.caps || []) ensureCapUnit(c.capUnit);

  const policyData = {
    organizationId,
    name: String(payload.name).trim(),
    categoryId: payload.categoryId ?? null,
    destinationScope: scope,
    costsCenter: payload.costsCenter ? String(payload.costsCenter).trim() : null,
    dailyPerDiem: payload.dailyPerDiem ?? null,
    currency: payload.currency || "MXN",
    validFrom: new Date(payload.validFrom),
    validTo: payload.validTo ? new Date(payload.validTo) : null,
    active: true,
  };

  return createPolicyWithCapsTx(policyData, payload.caps || [], hasOverlap);
}

/**
 * Updates a policy. Caps are replaced atomically (idempotent setExpenseCaps semantics).
 *
 * @param {number} policyId
 * @param {bigint | number} organizationId
 * @param {object} payload
 */
export async function updatePolicy(policyId, organizationId, payload) {
  const existing = await getPolicy(policyId, organizationId);
  if (!existing) {
    const err = new Error(`Política ${policyId} no encontrada.`);
    err.status = 404;
    throw err;
  }
  if (payload.destinationScope) ensureScope(payload.destinationScope);
  if (payload.validFrom || payload.validTo) {
    ensureValidDates(payload.validFrom ?? existing.validFrom, payload.validTo ?? existing.validTo);
  }
  for (const c of payload.caps || []) ensureCapUnit(c.capUnit);

  const data = {};
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
  return updatePolicyWithCapsTx(
    policyId,
    data,
    payload.caps,
    setExpenseCapsInTx,
    checkPayload,
    hasOverlap,
  );
}

/**
 * Soft-deletes (active=false). Idempotent.
 */
export async function deactivatePolicy(policyId, organizationId) {
  const existing = await getPolicy(policyId, organizationId);
  if (!existing) {
    const err = new Error(`Política ${policyId} no encontrada.`);
    err.status = 404;
    throw err;
  }
  return updatePolicyRow(policyId, { active: false });
}

/**
 * Idempotent replacement of expense caps for a policy.
 */
export async function setExpenseCaps(policyId, organizationId, caps) {
  const existing = await getPolicy(policyId, organizationId);
  if (!existing) {
    const err = new Error(`Política ${policyId} no encontrada.`);
    err.status = 404;
    throw err;
  }
  for (const c of caps) ensureCapUnit(c.capUnit);
  return replaceExpenseCapsTx(policyId, caps);
}

/**
 * Resolves the applicable policy for a request and its evaluation context,
 * then freezes it into Request.policyEvaluationSnapshot.
 *
 * @param {any} tx - Prisma transaction client (o null)
 * @param {number} requestId
 * @param {{ destinationScope: "nacional" | "internacional" | "any", categoryId?: number | null, costsCenter?: string | null }} ctx
 */
export async function snapshotPolicyForRequest(tx, requestId, ctx) {
  const { orgId, policies } = await findPoliciesForRequestSnapshot(tx, requestId);
  if (!orgId) return { policyId: null, snapshot: null };

  const policy = findApplicablePolicy(policies, {
    categoryId: ctx.categoryId ?? null,
    destinationScope: ctx.destinationScope,
    costsCenter: ctx.costsCenter ?? null,
    evaluationDate: new Date(),
  });
  const caps = policy ? policy.expenseCaps : [];
  const snapshot = buildPolicyEvaluationSnapshot(policy, caps, { requestId, organizationId: orgId });

  await updateRequestSnapshot(tx, requestId, snapshot);

  return { policyId: policy ? policy.policyId : null, snapshot };
}
