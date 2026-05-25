/**
 * @module PrismaRequestJourneyQueries
 * @description Adapter Prisma del port `RequestJourneyQueries`. Lee la
 * solicitud + su `requestStatus`, rutas (`routeRequests.route`) y el
 * `solicitudHistorial` (orden cronológico) con el usuario/rol del actor.
 */
import prisma from "~/platform/db/prisma.server.js";
import type {
  RequestJourneyQueries,
  RequestJourneyData,
} from "~/contexts/travel-requests/domain/ports/RequestJourneyQueries.js";

export class PrismaRequestJourneyQueries implements RequestJourneyQueries {
  async getJourneyData(requestId: number): Promise<RequestJourneyData | null> {
    const request = await prisma.request.findUnique({
      where: { requestId: Number(requestId) },
      include: {
        requestStatus: true,
        routeRequests: { include: { route: true } },
        solicitudHistorial: {
          orderBy: { createdAt: "asc" },
          include: { user: { include: { role: true } } },
        },
      },
    });
    if (!request) return null;

    return {
      currentStatusId: request.requestStatusId,
      currentStatusLabel: request.requestStatus?.status ?? "",
      workflowPreSnapshot: request.workflowPreSnapshot,
      routeRequests: request.routeRequests.map((rr) => ({
        route: rr.route
          ? { hotelNeeded: rr.route.hotelNeeded, planeNeeded: rr.route.planeNeeded }
          : null,
      })),
      creationDate: request.creationDate,
      historial: request.solicitudHistorial.map((h) => ({
        accion: h.accion,
        createdAt: h.createdAt,
        comentario: h.comentario,
        user: {
          userName: h.user?.userName,
          role: h.user?.role ? { roleName: h.user.role.roleName } : undefined,
        },
      })),
    };
  }
}
