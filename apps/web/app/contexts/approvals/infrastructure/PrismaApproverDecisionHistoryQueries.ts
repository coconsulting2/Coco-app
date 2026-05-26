/**
 * @module PrismaApproverDecisionHistoryQueries
 * @description Adapter Prisma del port `ApproverDecisionHistoryQueries`. Lee
 * `solicitud_historial` filtrando por `userId` = el aprobador, e incluye el
 * destino / fechas / status / solicitante de cada solicitud asociada.
 */
import prisma from "~/platform/db/prisma.server.js";
import type {
  ApproverDecisionHistoryQueries,
  ApproverDecisionHistoryItem,
  ApproverDecisionHistoryOpts,
  ApproverDecisionAction,
} from "~/contexts/approvals/domain/ports/ApproverDecisionHistoryQueries.js";

const DECISION_ACTIONS: readonly ApproverDecisionAction[] = [
  "APROBADO",
  "RECHAZADO",
  "ESCALADO",
  "REASIGNADO",
] as const;

export class PrismaApproverDecisionHistoryQueries
  implements ApproverDecisionHistoryQueries
{
  async findByApprover(
    approverUserId: number,
    opts: ApproverDecisionHistoryOpts = {},
  ): Promise<ApproverDecisionHistoryItem[]> {
    const actor = Number(approverUserId);
    if (!Number.isFinite(actor) || actor < 1) return [];

    const where: {
      userId: number;
      accion: { in: ApproverDecisionAction[] };
      organizationId?: bigint;
    } = {
      userId: actor,
      accion: { in: [...DECISION_ACTIONS] },
    };
    if (opts.organizationId != null && String(opts.organizationId).trim() !== "") {
      where.organizationId = BigInt(String(opts.organizationId).trim());
    }

    const rows = await prisma.solicitudHistorial.findMany({
      where,
      include: {
        request: {
          include: {
            user: true,
            requestStatus: true,
            routeRequests: {
              include: { route: { include: { destinationCountry: true } } },
              orderBy: { route: { routerIndex: "asc" } },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      ...(opts.n ? { take: Number(opts.n) } : {}),
    });

    return rows.map((h) => {
      const req = h.request;
      const firstRoute = req?.routeRequests?.[0]?.route;
      return {
        historialId: h.historialId,
        requestId: h.requestId,
        action: h.accion as ApproverDecisionAction,
        comentario: h.comentario ?? null,
        decidedAt: h.createdAt,
        destinationCountry: firstRoute?.destinationCountry?.countryName ?? null,
        beginningDate: firstRoute?.beginningDate ?? null,
        endingDate: firstRoute?.endingDate ?? null,
        requestStatus: req?.requestStatus?.status ?? null,
        requesterName: req?.user?.userName ?? null,
      };
    });
  }
}
