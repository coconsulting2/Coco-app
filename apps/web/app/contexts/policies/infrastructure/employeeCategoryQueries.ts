/**
 * @module employeeCategoryQueries
 * @description Adapter Prisma del puerto EmployeeCategoryQueriesPort.
 * Toda la dependencia de Prisma del CRUD de categorías vive aquí.
 */
import prisma from "~/platform/db/prisma.server.js";
import type { EmployeeCategoryRow } from "~/contexts/policies/domain/types";
import type { EmployeeCategoryQueriesPort } from "~/contexts/policies/domain/ports/EmployeeCategoryQueriesPort";

export async function listCategoriesForOrg(
  organizationId: bigint | number,
  opts: { activeOnly?: boolean } = {},
): Promise<EmployeeCategoryRow[]> {
  const where: Record<string, unknown> = { organizationId };
  if (opts.activeOnly !== false) where.active = true;
  return prisma.employeeCategory.findMany({
    where: where as never,
    orderBy: [{ name: "asc" }],
  }) as unknown as Promise<EmployeeCategoryRow[]>;
}

export async function findCategoryById(
  categoryId: number,
): Promise<EmployeeCategoryRow | null> {
  return prisma.employeeCategory.findUnique({
    where: { categoryId: Number(categoryId) },
  }) as unknown as Promise<EmployeeCategoryRow | null>;
}

export async function createCategoryRow(data: {
  organizationId: bigint | number;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
}): Promise<EmployeeCategoryRow> {
  return prisma.employeeCategory.create({
    data: data as never,
  }) as unknown as Promise<EmployeeCategoryRow>;
}

export async function updateCategoryRow(
  categoryId: number,
  data: Partial<Pick<EmployeeCategoryRow, "name" | "description" | "active">>,
): Promise<EmployeeCategoryRow> {
  return prisma.employeeCategory.update({
    where: { categoryId: Number(categoryId) },
    data: data as never,
  }) as unknown as Promise<EmployeeCategoryRow>;
}

/** Adapter pre-wireado del puerto EmployeeCategoryQueriesPort. */
export const prismaEmployeeCategoryQueries: EmployeeCategoryQueriesPort = {
  listCategoriesForOrg,
  findCategoryById,
  createCategoryRow,
  updateCategoryRow,
};
