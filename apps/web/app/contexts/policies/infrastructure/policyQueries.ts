/**
 * @module policyQueries
 * @description Adapter Prisma del puerto PolicyQueriesPort (TravelPolicy +
 * PolicyExpenseCap). Toda la dependencia de Prisma del CRUD de políticas vive
 * aquí; application/ consume el puerto.
 */
import prisma from "~/platform/db/prisma.server.js";
import type {
  ExpenseCapInput,
  PolicyData,
  TravelPolicyRow,
} from "~/contexts/policies/domain/types";
import type {
  OverlapCheck,
  PolicyQueriesPort,
  SetCapsInTx,
} from "~/contexts/policies/domain/ports/PolicyQueriesPort";
import { httpError } from "~/contexts/policies/domain/types";

type PrismaLike = typeof prisma;

function capCreateData(policyId: number, caps: ExpenseCapInput[]) {
  return caps.map((c) => ({
    policyId,
    receiptTypeId: Number(c.receiptTypeId),
    capAmount: c.capAmount,
    capUnit: c.capUnit,
    currency: c.currency || "MXN",
  }));
}

export async function listPoliciesWith(
  where: Record<string, unknown>,
): Promise<TravelPolicyRow[]> {
  return prisma.travelPolicy.findMany({
    where: where as never,
    include: { expenseCaps: true, category: true },
    orderBy: [{ validFrom: "desc" }],
  }) as unknown as Promise<TravelPolicyRow[]>;
}

export async function findPolicyById(
  policyId: number,
): Promise<TravelPolicyRow | null> {
  return prisma.travelPolicy.findUnique({
    where: { policyId: Number(policyId) },
    include: { expenseCaps: true, category: true },
  }) as unknown as Promise<TravelPolicyRow | null>;
}

export async function updatePolicyRow(
  policyId: number,
  data: Record<string, unknown>,
): Promise<TravelPolicyRow> {
  return prisma.travelPolicy.update({
    where: { policyId: Number(policyId) },
    data: data as never,
  }) as unknown as Promise<TravelPolicyRow>;
}

export async function createPolicyWithCapsTx(
  policyData: PolicyData,
  caps: ExpenseCapInput[],
  overlapCheck: OverlapCheck,
): Promise<TravelPolicyRow> {
  return prisma.$transaction(async (tx) => {
    const overlap = await overlapCheck(
      tx as never,
      policyData as never,
    );
    if (overlap) {
      throw httpError(
        "Ya existe una política activa que solapa con la combinación (categoría, destino, centro de costos) y rango de vigencia.",
        409,
      );
    }
    const policy = await tx.travelPolicy.create({ data: policyData as never });
    if (Array.isArray(caps) && caps.length > 0) {
      await tx.policyExpenseCap.createMany({
        data: capCreateData(policy.policyId, caps),
      });
    }
    return tx.travelPolicy.findUnique({
      where: { policyId: policy.policyId },
      include: { expenseCaps: true, category: true },
    });
  }) as unknown as Promise<TravelPolicyRow>;
}

export async function updatePolicyWithCapsTx(
  policyId: number,
  updateData: Record<string, unknown>,
  caps: ExpenseCapInput[] | undefined,
  setCapsTx: SetCapsInTx,
  overlapPayload: Record<string, unknown>,
  overlapCheck: OverlapCheck,
): Promise<TravelPolicyRow> {
  return prisma.$transaction(async (tx) => {
    const overlap = await overlapCheck(
      tx as never,
      overlapPayload as never,
      policyId,
    );
    if (overlap) {
      throw httpError("La actualización solaparía con otra política activa.", 409);
    }
    await tx.travelPolicy.update({
      where: { policyId: Number(policyId) },
      data: updateData as never,
    });
    if (caps !== undefined) {
      await setCapsTx(tx, Number(policyId), caps);
    }
    return tx.travelPolicy.findUnique({
      where: { policyId: Number(policyId) },
      include: { expenseCaps: true, category: true },
    });
  }) as unknown as Promise<TravelPolicyRow>;
}

export const setExpenseCapsInTx: SetCapsInTx = async (tx, policyId, caps) => {
  const client = tx as { policyExpenseCap: PrismaLike["policyExpenseCap"] };
  await client.policyExpenseCap.deleteMany({ where: { policyId } });
  if (caps.length === 0) return;
  await client.policyExpenseCap.createMany({
    data: capCreateData(policyId, caps),
  });
};

export async function replaceExpenseCapsTx(
  policyId: number,
  caps: ExpenseCapInput[],
): Promise<TravelPolicyRow> {
  return prisma.$transaction(async (tx) => {
    await setExpenseCapsInTx(tx, Number(policyId), caps);
    return tx.travelPolicy.findUnique({
      where: { policyId: Number(policyId) },
      include: { expenseCaps: true },
    });
  }) as unknown as Promise<TravelPolicyRow>;
}

export async function findPoliciesForRequestSnapshot(
  tx: unknown,
  requestId: number,
): Promise<{ orgId: bigint | null; policies: TravelPolicyRow[] }> {
  const db = (tx as PrismaLike) || prisma;
  const req = await db.request.findUnique({
    where: { requestId: Number(requestId) },
    select: { requestId: true, user: { select: { organizationId: true } } },
  });
  if (!req || !req.user || !req.user.organizationId) {
    return { orgId: null, policies: [] };
  }
  const policies = (await db.travelPolicy.findMany({
    where: { organizationId: req.user.organizationId, active: true },
    include: { expenseCaps: true },
  })) as unknown as TravelPolicyRow[];
  return { orgId: req.user.organizationId, policies };
}

export async function updateRequestSnapshot(
  tx: unknown,
  requestId: number,
  snapshot: unknown,
): Promise<unknown> {
  const db = (tx as PrismaLike) || prisma;
  return db.request.update({
    where: { requestId: Number(requestId) },
    data: { policyEvaluationSnapshot: snapshot as never },
  });
}

/** Adapter pre-wireado del puerto PolicyQueriesPort. */
export const prismaPolicyQueries: PolicyQueriesPort = {
  listPoliciesWith,
  findPolicyById,
  updatePolicyRow,
  createPolicyWithCapsTx,
  updatePolicyWithCapsTx,
  setExpenseCapsInTx,
  replaceExpenseCapsTx,
  findPoliciesForRequestSnapshot,
  updateRequestSnapshot,
};
