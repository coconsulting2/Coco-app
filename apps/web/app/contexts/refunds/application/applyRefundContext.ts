/**
 * @module applyRefundContext
 * @description Helper invocado al crear/confirmar una solicitud para llenar
 * Request.tripEndDate y Request.policyEvaluationSnapshot (M2-006 RF-46).
 */
import { Prisma } from "@coco/db";
import { snapshotPolicyForRequest } from "~/contexts/policies/application/policyService.js";

const HOME_COUNTRY_ID = 1;

type RouteRow = {
  idDestinationCountry?: number | null;
  endingDate?: Date | string | null;
};

function inferDestinationScope(routes: RouteRow[]): "nacional" | "internacional" {
  const isInternational = (routes ?? []).some((r) => {
    if (r.idDestinationCountry == null) return false;
    return Number(r.idDestinationCountry) !== HOME_COUNTRY_ID;
  });
  return isInternational ? "internacional" : "nacional";
}

function maxEndingDate(routes: RouteRow[]): Date | null {
  let max: Date | null = null;
  for (const r of routes ?? []) {
    if (!r.endingDate) continue;
    const d = r.endingDate instanceof Date ? r.endingDate : new Date(r.endingDate);
    if (!max || d > max) max = d;
  }
  return max;
}

/**
 * Port mínimo de transacción que este helper consume. El cliente Prisma
 * extendido completo (`WebTransactionClient`) es asignable a este tipo, y
 * los stubs de test también — sin `unknown` laxo: los args están tipados con
 * los argument types generados por Prisma.
 */
type Tx = {
  routeRequest: {
    findMany(
      args: { where: Prisma.RouteRequestWhereInput; include: { route: true } },
    ): Promise<Array<{ route: RouteRow | null }>>;
  };
  request: {
    update(
      args: { where: Prisma.RequestWhereUniqueInput; data: { tripEndDate: Date } },
    ): Promise<unknown>;
  };
};

export async function applyRefundContextToRequest(
  tx: Tx,
  requestId: number,
  ctx: { categoryId?: number | null; costsCenter?: string | null } = {},
): Promise<{ tripEndDate: Date | null; policyId: number | null }> {
  const id = Number(requestId);
  const routeRequests = await tx.routeRequest.findMany({
    where: { requestId: id },
    include: { route: true },
  });
  const routes = routeRequests
    .map((rr) => rr.route)
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const tripEndDate = maxEndingDate(routes);
  if (tripEndDate) {
    await tx.request.update({
      where: { requestId: id },
      data: { tripEndDate },
    });
  }

  const destinationScope = inferDestinationScope(routes);
  const { policyId } = await snapshotPolicyForRequest(tx, id, {
    categoryId: ctx.categoryId ?? null,
    destinationScope,
    costsCenter: ctx.costsCenter ?? null,
  });

  return { tripEndDate, policyId };
}
