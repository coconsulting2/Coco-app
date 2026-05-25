/**
 * @module PrismaReimbursementTimeRepository
 * @description Adapter Prisma del puerto `ReimbursementTimeRepository`.
 * RLS-scoped via tenant extension (el caller debe estar dentro de
 * `runInTenant`/`runInRls`).
 */
import prisma from "~/platform/db/prisma.server.js";
import type {
  ReimbursementTimeRepository,
  ReimbursementTimeLimitRow,
  ReimbursementTimeLimitUpsert,
} from "~/contexts/refunds/domain/ports/ReimbursementTimeRepository.js";

type PrismaTimeLimit = {
  daysAfterTrip: number;
  graceDays: number;
  blockOnExpiry: boolean;
  active: boolean;
};

function toRow(record: PrismaTimeLimit): ReimbursementTimeLimitRow {
  return {
    daysAfterTrip: record.daysAfterTrip,
    graceDays: record.graceDays,
    blockOnExpiry: record.blockOnExpiry,
    active: record.active,
  };
}

export class PrismaReimbursementTimeRepository
  implements ReimbursementTimeRepository
{
  async findByOrg(
    organizationId: bigint | number,
  ): Promise<ReimbursementTimeLimitRow | null> {
    const record = (await prisma.reimbursementTimeLimit.findUnique({
      where: { organizationId: BigInt(organizationId) },
    })) as PrismaTimeLimit | null;
    return record ? toRow(record) : null;
  }

  async upsert(
    organizationId: bigint | number,
    data: ReimbursementTimeLimitUpsert,
  ): Promise<ReimbursementTimeLimitRow> {
    const record = (await prisma.reimbursementTimeLimit.upsert({
      where: { organizationId: BigInt(organizationId) },
      update: {
        daysAfterTrip: data.daysAfterTrip,
        graceDays: data.graceDays,
        blockOnExpiry: data.blockOnExpiry,
        active: data.active,
        updatedById: data.updatedById,
      },
      create: {
        organizationId: BigInt(organizationId),
        daysAfterTrip: data.daysAfterTrip,
        graceDays: data.graceDays,
        blockOnExpiry: data.blockOnExpiry,
        active: data.active,
        updatedById: data.updatedById,
      } as never,
    })) as PrismaTimeLimit;
    return toRow(record);
  }
}
