/**
 * @module employeeCategoryQueries
 * @description Queries Prisma para CRUD de categorías de empleado.
 * Extracción Fase 6 desde employeeCategoryService (application/).
 */
import prisma from "~/platform/db/prisma.server.js";

/**
 * @param {bigint | number} organizationId
 * @param {{ activeOnly?: boolean }} [opts]
 * @returns {Promise<object[]>}
 */
export async function listCategoriesForOrg(organizationId, opts = {}) {
  const where = { organizationId };
  if (opts.activeOnly !== false) where.active = true;
  return prisma.employeeCategory.findMany({
    where,
    orderBy: [{ name: "asc" }],
  });
}

/**
 * @param {number} categoryId
 * @returns {Promise<object | null>}
 */
export async function findCategoryById(categoryId) {
  return prisma.employeeCategory.findUnique({ where: { categoryId: Number(categoryId) } });
}

/**
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function createCategoryRow(data) {
  return prisma.employeeCategory.create({ data });
}

/**
 * @param {number} categoryId
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function updateCategoryRow(categoryId, data) {
  return prisma.employeeCategory.update({
    where: { categoryId: Number(categoryId) },
    data,
  });
}
