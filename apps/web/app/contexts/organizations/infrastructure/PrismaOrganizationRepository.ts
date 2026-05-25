/**
 * @module PrismaOrganizationRepository
 * @description Adapter Prisma del puerto `OrganizationRepository`. Único punto
 * del slice (junto con los seedHelpers de `@coco/db`) que toca Prisma.
 */
import prisma from "~/platform/db/prisma.server.js";
import type {
  CreateOrganizationData,
  ListOrganizationsPaging,
  ListOrganizationsResult,
  ListOrganizationsWhere,
  OrganizationRecord,
  OrganizationRepository,
  UpdateOrganizationData,
} from "~/contexts/organizations/domain/ports/OrganizationRepository.js";

export class PrismaOrganizationRepository implements OrganizationRepository {
  async list(
    where: ListOrganizationsWhere,
    paging: ListOrganizationsPaging,
  ): Promise<ListOrganizationsResult> {
    const { page, pageSize } = paging;
    const [rows, total] = await Promise.all([
      prisma.organization.findMany({
        where: where as never,
        orderBy: [{ kind: "asc" }, { nombre: "asc" }] as never,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }) as unknown as Promise<OrganizationRecord[]>,
      prisma.organization.count({ where: where as never }),
    ]);
    return { rows, total };
  }

  async findById(id: bigint): Promise<OrganizationRecord | null> {
    return prisma.organization.findUnique({
      where: { id },
    }) as unknown as Promise<OrganizationRecord | null>;
  }

  async create(data: CreateOrganizationData): Promise<OrganizationRecord> {
    return prisma.organization.create({
      data: data as never,
    }) as unknown as Promise<OrganizationRecord>;
  }

  async update(
    id: bigint,
    data: UpdateOrganizationData,
  ): Promise<OrganizationRecord> {
    return prisma.organization.update({
      where: { id },
      data: data as never,
    }) as unknown as Promise<OrganizationRecord>;
  }
}
