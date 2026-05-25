/**
 * @module PrismaReceiptValidationSubmission
 * @description Adapter Prisma del port `ReceiptValidationSubmission`. Paridad
 * con `applicantModel.getRequestStatus` + `updateRequestStatusToValidationStage`.
 */
import prisma from "~/platform/db/prisma.server.js";
import type { ReceiptValidationSubmission } from "~/contexts/travel-requests/domain/ports/ReceiptValidationSubmission.js";

export class PrismaReceiptValidationSubmission implements ReceiptValidationSubmission {
  async getRequestStatus(requestId: number): Promise<number | null> {
    const request = await prisma.request.findUnique({
      where: { requestId: Number(requestId) },
      select: { requestStatusId: true },
    });
    return request ? request.requestStatusId : null;
  }

  async updateStatusToValidationStage(requestId: number): Promise<void> {
    await prisma.request.update({
      where: { requestId: Number(requestId) },
      data: { requestStatusId: 7 },
    });
  }
}
