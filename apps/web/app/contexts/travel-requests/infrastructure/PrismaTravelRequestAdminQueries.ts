/**
 * @module PrismaTravelRequestAdminQueries
 * @description Adapter Prisma del port `TravelRequestAdminQueries`.
 */
import prisma from "~/platform/db/prisma.server.js";
import type {
  TravelRequestAdminQueries,
  TravelRequestDetailRow,
  TravelRequestSummaryByDept,
} from "~/contexts/travel-requests/domain/ports/TravelRequestAdminQueries.js";

export class PrismaTravelRequestAdminQueries implements TravelRequestAdminQueries {
  async findByIdWithRoutes(requestId: number): Promise<TravelRequestDetailRow[]> {
    const request = await prisma.request.findUnique({
      where: { requestId: Number(requestId) },
      include: {
        user: true,
        requestStatus: true,
        routeRequests: {
          include: {
            route: {
              include: {
                originCountry: true,
                originCity: true,
                destinationCountry: true,
                destinationCity: true,
              },
            },
          },
          orderBy: { route: { routerIndex: "asc" } },
        },
      },
    });
    if (!request) return [];
    if (request.routeRequests.length === 0) {
      return [
        {
          requestId: request.requestId,
          requestStatus: request.requestStatus.status,
          notes: request.notes,
          requestedFee: request.requestedFee,
          imposedFee: request.imposedFee,
          requestDays: request.requestDays,
          creationDate: request.creationDate,
          userName: request.user?.userName ?? null,
          userEmail: request.user?.email ?? null,
          userPhoneNumber: request.user?.phoneNumber ?? null,
          routerIndex: null,
          originCountry: null,
          originCity: null,
          destinationCountry: null,
          destinationCity: null,
          beginningDate: null,
          beginningTime: null,
          endingDate: null,
          endingTime: null,
          hotelNeeded: null,
          planeNeeded: null,
        },
      ];
    }
    return request.routeRequests.map((rr) => {
      const route = rr.route;
      return {
        requestId: request.requestId,
        requestStatus: request.requestStatus.status,
        notes: request.notes,
        requestedFee: request.requestedFee,
        imposedFee: request.imposedFee,
        requestDays: request.requestDays,
        creationDate: request.creationDate,
        userName: request.user?.userName ?? null,
        userEmail: request.user?.email ?? null,
        userPhoneNumber: request.user?.phoneNumber ?? null,
        routerIndex: route?.routerIndex ?? null,
        originCountry: route?.originCountry?.countryName ?? null,
        originCity: route?.originCity?.cityName ?? null,
        destinationCountry: route?.destinationCountry?.countryName ?? null,
        destinationCity: route?.destinationCity?.cityName ?? null,
        beginningDate: route?.beginningDate ?? null,
        beginningTime: route?.beginningTime ?? null,
        endingDate: route?.endingDate ?? null,
        endingTime: route?.endingTime ?? null,
        hotelNeeded: route?.hotelNeeded ?? null,
        planeNeeded: route?.planeNeeded ?? null,
      };
    });
  }

  async findByDeptStatus(
    deptId: number,
    statusId: number,
    limit?: number | null,
  ): Promise<TravelRequestSummaryByDept[]> {
    const requests = await prisma.request.findMany({
      where: {
        user: { departmentId: Number(deptId) },
        requestStatusId: Number(statusId),
      },
      include: {
        user: true,
        requestStatus: true,
        routeRequests: {
          include: { route: { include: { destinationCountry: true } } },
          orderBy: { route: { routerIndex: "asc" } },
          take: 1,
        },
      },
      orderBy: { creationDate: "desc" },
      ...(limit ? { take: Number(limit) } : {}),
    });
    return requests.map((r) => {
      const firstRoute = r.routeRequests[0]?.route;
      return {
        requestId: r.requestId,
        userId: r.userId,
        destinationCountry: firstRoute?.destinationCountry?.countryName ?? null,
        beginningDate: firstRoute?.beginningDate ?? null,
        endingDate: firstRoute?.endingDate ?? null,
        requestStatus: r.requestStatus.status,
      };
    });
  }
}
