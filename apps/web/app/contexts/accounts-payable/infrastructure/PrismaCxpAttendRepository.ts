/**
 * @module PrismaCxpAttendRepository
 * @description Adapter Prisma del puerto `CxpAttendRepository`. Composición
 * de la query `requestExists` + transición de status de `accountsPayableModel.js`
 * legacy, ahora tipada.
 */
import prisma from "~/platform/db/prisma.server.js";
import type { CxpAttendRepository } from "~/contexts/accounts-payable/domain/ports/CxpAttendRepository.js";

export class PrismaCxpAttendRepository implements CxpAttendRepository {
  async getAgencyNeeds(
    requestId: number,
  ): Promise<{ needsPlane: boolean; needsHotel: boolean } | null> {
    const request = await prisma.request.findUnique({
      where: { requestId: Number(requestId) },
      include: {
        routeRequests: { include: { route: true } },
      },
    });
    if (!request) return null;
    const needsPlane = request.routeRequests.some((rr) => rr.route?.planeNeeded === true);
    const needsHotel = request.routeRequests.some((rr) => rr.route?.hotelNeeded === true);
    return { needsPlane, needsHotel };
  }

  async assignImposedFee(
    requestId: number,
    imposedFee: number,
    nextStatusId: 5 | 7,
  ): Promise<void> {
    await prisma.request.update({
      where: { requestId: Number(requestId) },
      data: {
        imposedFee: Number(imposedFee),
        requestStatusId: Number(nextStatusId),
      },
    });
  }
}
