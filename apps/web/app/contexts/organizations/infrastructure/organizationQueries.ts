/**
 * @module organizationQueries
 * @description Queries Prisma para Organization CRUD.
 */
import prisma from "~/platform/db/prisma.server.js";

export type OrganizationRow = {
  id: bigint;
  nombre: string;
  rfc: string | null;
  razonSocial: string | null;
  logoUrl: string | null;
  timezone: string;
  baseCurrency: string;
  kind: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function createOrganizationRow(
  data: Record<string, unknown>,
): Promise<OrganizationRow> {
  return prisma.organization.create({ data: data as never }) as Promise<OrganizationRow>;
}

export async function listOrganizationsPaginated(
  where: Record<string, unknown>,
  opts: { page?: number; pageSize?: number; orderBy?: Record<string, "asc" | "desc">[] },
): Promise<{ rows: OrganizationRow[]; total: number }> {
  const {
    page = 1,
    pageSize = 25,
    orderBy = [{ kind: "asc" }, { nombre: "asc" }],
  } = opts;
  const [rows, total] = await Promise.all([
    prisma.organization.findMany({
      where: where as never,
      orderBy: orderBy as never,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }) as unknown as Promise<OrganizationRow[]>,
    prisma.organization.count({ where: where as never }),
  ]);
  return { rows, total };
}

export async function findOrganizationById(id: bigint): Promise<OrganizationRow | null> {
  return prisma.organization.findUnique({ where: { id } }) as Promise<
    OrganizationRow | null
  >;
}

export async function updateOrganizationRow(
  id: bigint,
  data: Record<string, unknown>,
): Promise<OrganizationRow> {
  return prisma.organization.update({
    where: { id },
    data: data as never,
  }) as Promise<OrganizationRow>;
}

export { prisma as prismaClient };
