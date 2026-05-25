/**
 * @module PrismaExpensePolicyPreviewQueries
 * @description Adapter Prisma del port `ExpensePolicyPreviewQueries`. Lee el
 * contexto de la solicitud (snapshot + org del solicitante + rutas con países)
 * y las políticas activas de la organización con sus topes. Es la única pieza
 * del preview que toca Prisma.
 */
import prisma from "~/platform/db/prisma.server.js";
import type {
  ActivePolicyWithCaps,
  ExpensePolicyPreviewQueries,
  PolicyEvaluationSnapshot,
  RequestPreviewContext,
} from "~/contexts/policies/domain/ports/ExpensePolicyPreviewQueries.js";

export class PrismaExpensePolicyPreviewQueries
  implements ExpensePolicyPreviewQueries
{
  async findRequestContext(
    requestId: number,
  ): Promise<RequestPreviewContext | null> {
    const row = await prisma.request.findUnique({
      where: { requestId: Number(requestId) },
      select: {
        requestId: true,
        policyEvaluationSnapshot: true,
        user: { select: { organizationId: true } },
        routeRequests: { include: { route: true } },
      },
    });
    if (!row) return null;

    const snapshot = (row.policyEvaluationSnapshot ??
      null) as PolicyEvaluationSnapshot | null;

    return {
      requestId: Number(row.requestId),
      policyEvaluationSnapshot: snapshot,
      organizationId: row.user?.organizationId ?? null,
      routeRequests: (row.routeRequests ?? []).map((rr) => ({
        route: rr.route
          ? {
              idOriginCountry: rr.route.idOriginCountry ?? null,
              idDestinationCountry: rr.route.idDestinationCountry ?? null,
            }
          : null,
      })),
    };
  }

  async listActivePoliciesForOrg(
    organizationId: bigint | number,
  ): Promise<ActivePolicyWithCaps[]> {
    const rows = await prisma.travelPolicy.findMany({
      where: { organizationId, active: true },
      include: { expenseCaps: true },
    });
    return rows as unknown as ActivePolicyWithCaps[];
  }
}
