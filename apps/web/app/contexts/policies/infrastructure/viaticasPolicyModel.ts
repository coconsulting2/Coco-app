/**
 * @module viaticasPolicyModel
 * @description Adapter Prisma del puerto ViaticosPolicyRepositoryPort. Mapea
 * filas de Prisma al shape de presentación legacy (snake_case).
 */
import prisma from "~/platform/db/prisma.server.js";
import type { ViaticosPolicyRepositoryPort } from "~/contexts/policies/domain/ports/ViaticosPolicyPort";
import type {
  ViaticosPolicyPayload,
  ViaticosPolicyRow,
} from "~/contexts/policies/domain/types";

interface PrismaViaticosRow {
  id: number | bigint;
  organizationId: bigint;
  maxHotel: number | string | { toString(): string };
  maxMeal: number | string | { toString(): string };
  currency: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function toRow(row: PrismaViaticosRow): ViaticosPolicyRow {
  return {
    id: row.id,
    org_id: row.organizationId.toString(),
    max_hotel: Number(row.maxHotel),
    max_meal: Number(row.maxMeal),
    currency: row.currency,
    active: row.active,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

const ViaticasPolicy: ViaticosPolicyRepositoryPort = {
  async getByOrg(organizationId: bigint | number): Promise<ViaticosPolicyRow | null> {
    const row = (await prisma.viaticosPolicy.findUnique({
      where: { organizationId: BigInt(organizationId) },
    })) as PrismaViaticosRow | null;
    if (!row) return null;
    return toRow(row);
  },

  async upsert(
    organizationId: bigint | number,
    payload: ViaticosPolicyPayload,
  ): Promise<ViaticosPolicyRow> {
    const data = {
      maxHotel: payload.maxHotel,
      maxMeal: payload.maxMeal,
      currency: payload.currency ?? "MXN",
      active: payload.active ?? true,
    };
    const row = (await prisma.viaticosPolicy.upsert({
      where: { organizationId: BigInt(organizationId) },
      update: data,
      create: { organizationId: BigInt(organizationId), ...data },
    })) as PrismaViaticosRow;
    return toRow(row);
  },
};

export default ViaticasPolicy;
