/**
 * @module PrismaAgencyAttendRepository
 * @description Adapter Prisma del puerto `AgencyAttendRepository`. Equivale
 * a las dos operaciones que el legacy `travelAgentModel.js` exponía sobre
 * la transición de Agencia → Comprobación.
 */
import prisma from "~/platform/db/prisma.server.js";
import type { AgencyAttendRepository } from "~/contexts/travel-agency/domain/ports/AgencyAttendRepository.js";

export class PrismaAgencyAttendRepository implements AgencyAttendRepository {
  async requestExists(requestId: number): Promise<boolean> {
    const row = await prisma.request.findUnique({
      where: { requestId: Number(requestId) },
      select: { requestId: true },
    });
    return Boolean(row);
  }

  async markAttended(requestId: number): Promise<void> {
    await prisma.request.update({
      where: { requestId: Number(requestId) },
      data: { requestStatusId: 6 },
    });
  }
}
