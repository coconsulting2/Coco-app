/**
 * @module policyQueries
 * @description Queries Prisma para TravelPolicy + PolicyExpenseCap.
 * Extracción Fase 6 desde policyService.
 */
import prisma from "~/platform/db/prisma.server.js";

/**
 * @param {object} where
 * @returns {Promise<object[]>}
 */
export async function listPoliciesWith(where) {
  return prisma.travelPolicy.findMany({
    where,
    include: { expenseCaps: true, category: true },
    orderBy: [{ validFrom: "desc" }],
  });
}

/**
 * @param {number} policyId
 * @returns {Promise<object | null>}
 */
export async function findPolicyById(policyId) {
  return prisma.travelPolicy.findUnique({
    where: { policyId: Number(policyId) },
    include: { expenseCaps: true, category: true },
  });
}

/**
 * @param {number} policyId
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function updatePolicyRow(policyId, data) {
  return prisma.travelPolicy.update({
    where: { policyId: Number(policyId) },
    data,
  });
}

/**
 * Crea política con caps atómicamente, con guard de overlap.
 *
 * @param {object} policyData
 * @param {Array<object>} caps
 * @param {(tx: any, data: object) => Promise<boolean>} overlapCheck - función que el caller provee para validar solapamiento
 * @returns {Promise<object>}
 */
export async function createPolicyWithCapsTx(policyData, caps, overlapCheck) {
  return prisma.$transaction(async (tx) => {
    const overlap = await overlapCheck(tx, policyData);
    if (overlap) {
      const err = new Error(
        "Ya existe una política activa que solapa con la combinación (categoría, destino, centro de costos) y rango de vigencia.",
      );
      err.status = 409;
      throw err;
    }
    const policy = await tx.travelPolicy.create({ data: policyData });
    if (Array.isArray(caps) && caps.length > 0) {
      await tx.policyExpenseCap.createMany({
        data: caps.map((c) => ({
          policyId: policy.policyId,
          receiptTypeId: Number(c.receiptTypeId),
          capAmount: c.capAmount,
          capUnit: c.capUnit,
          currency: c.currency || "MXN",
        })),
      });
    }
    return tx.travelPolicy.findUnique({
      where: { policyId: policy.policyId },
      include: { expenseCaps: true, category: true },
    });
  });
}

/**
 * Actualiza política + reemplaza caps atómicamente (si se proveen).
 *
 * @param {number} policyId
 * @param {object} updateData
 * @param {Array<object> | undefined} caps
 * @param {(tx: any, policyId: number, caps: object[]) => Promise<void>} setCapsTx
 * @param {object} overlapPayload
 * @param {(tx: any, payload: object, excludePolicyId: number) => Promise<boolean>} overlapCheck
 * @returns {Promise<object>}
 */
export async function updatePolicyWithCapsTx(
  policyId,
  updateData,
  caps,
  setCapsTx,
  overlapPayload,
  overlapCheck,
) {
  return prisma.$transaction(async (tx) => {
    const overlap = await overlapCheck(tx, overlapPayload, policyId);
    if (overlap) {
      const err = new Error("La actualización solaparía con otra política activa.");
      err.status = 409;
      throw err;
    }
    await tx.travelPolicy.update({ where: { policyId: Number(policyId) }, data: updateData });
    if (caps !== undefined) {
      await setCapsTx(tx, Number(policyId), caps);
    }
    return tx.travelPolicy.findUnique({
      where: { policyId: Number(policyId) },
      include: { expenseCaps: true, category: true },
    });
  });
}

/**
 * Helper transaccional: setea caps de una política reemplazándolos por completo.
 *
 * @param {any} tx
 * @param {number} policyId
 * @param {Array<object>} caps
 */
export async function setExpenseCapsInTx(tx, policyId, caps) {
  await tx.policyExpenseCap.deleteMany({ where: { policyId } });
  if (caps.length === 0) return;
  await tx.policyExpenseCap.createMany({
    data: caps.map((c) => ({
      policyId,
      receiptTypeId: Number(c.receiptTypeId),
      capAmount: c.capAmount,
      capUnit: c.capUnit,
      currency: c.currency || "MXN",
    })),
  });
}

/**
 * Reemplazo idempotente de caps en una política existente (transacción dedicada).
 *
 * @param {number} policyId
 * @param {Array<object>} caps
 * @returns {Promise<object>}
 */
export async function replaceExpenseCapsTx(policyId, caps) {
  return prisma.$transaction(async (tx) => {
    await setExpenseCapsInTx(tx, Number(policyId), caps);
    return tx.travelPolicy.findUnique({
      where: { policyId: Number(policyId) },
      include: { expenseCaps: true },
    });
  });
}

/**
 * Para snapshotPolicyForRequest: lookup mínimo del Request + caps de su org.
 *
 * @param {any} tx - prisma client o transaction
 * @param {number} requestId
 * @returns {Promise<{ orgId: bigint | null; policies: object[] }>}
 */
export async function findPoliciesForRequestSnapshot(tx, requestId) {
  const db = tx || prisma;
  const req = await db.request.findUnique({
    where: { requestId: Number(requestId) },
    select: { requestId: true, user: { select: { organizationId: true } } },
  });
  if (!req || !req.user || !req.user.organizationId) {
    return { orgId: null, policies: [] };
  }
  const policies = await db.travelPolicy.findMany({
    where: { organizationId: req.user.organizationId, active: true },
    include: { expenseCaps: true },
  });
  return { orgId: req.user.organizationId, policies };
}

/**
 * Actualiza el snapshot en el Request.
 *
 * @param {any} tx
 * @param {number} requestId
 * @param {object} snapshot
 */
export async function updateRequestSnapshot(tx, requestId, snapshot) {
  const db = tx || prisma;
  return db.request.update({
    where: { requestId: Number(requestId) },
    data: { policyEvaluationSnapshot: snapshot },
  });
}
