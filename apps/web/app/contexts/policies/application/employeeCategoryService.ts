/**
 * @module employeeCategoryService
 * @description CRUD de categorías de empleado para políticas de viáticos
 * (M2-006 RF-42). Categorías ortogonales a Role (RBAC) — usadas en
 * TravelPolicy.categoryId. Recibe el puerto de queries por DI.
 */
import { prismaEmployeeCategoryQueries } from "~/contexts/policies/infrastructure/employeeCategoryQueries.js";
import type { EmployeeCategoryQueriesPort } from "~/contexts/policies/domain/ports/EmployeeCategoryQueriesPort";
import {
  httpError,
  type CategoryPayload,
  type EmployeeCategoryRow,
  type HttpError,
} from "~/contexts/policies/domain/types";

export interface EmployeeCategoryServiceDeps {
  queries: EmployeeCategoryQueriesPort;
}

const defaultDeps: EmployeeCategoryServiceDeps = {
  queries: prismaEmployeeCategoryQueries,
};

/** Lists categories for an organization. By default returns only active rows. */
export async function listCategories(
  organizationId: bigint | number,
  opts: { activeOnly?: boolean } = {},
  deps: EmployeeCategoryServiceDeps = defaultDeps,
): Promise<EmployeeCategoryRow[]> {
  return deps.queries.listCategoriesForOrg(organizationId, opts);
}

/** Reads one category by id (scoped to org). */
export async function getCategory(
  categoryId: number,
  organizationId: bigint | number,
  deps: EmployeeCategoryServiceDeps = defaultDeps,
): Promise<EmployeeCategoryRow | null> {
  const row = await deps.queries.findCategoryById(categoryId);
  if (!row || String(row.organizationId) !== String(organizationId)) return null;
  return row;
}

/** Creates a new category. Maps unique-violation to status 409. */
export async function createCategory(
  organizationId: bigint | number,
  payload: CategoryPayload,
  deps: EmployeeCategoryServiceDeps = defaultDeps,
): Promise<EmployeeCategoryRow> {
  try {
    return await deps.queries.createCategoryRow({
      organizationId,
      code: String(payload.code).trim(),
      name: String(payload.name).trim(),
      description: payload.description ? String(payload.description).trim() : null,
      active: true,
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      throw httpError(
        `Categoría con code "${payload.code}" ya existe en esta organización.`,
        409,
      );
    }
    throw err as HttpError;
  }
}

/** Updates a category. Org-scoped. */
export async function updateCategory(
  categoryId: number,
  organizationId: bigint | number,
  payload: CategoryPayload,
  deps: EmployeeCategoryServiceDeps = defaultDeps,
): Promise<EmployeeCategoryRow> {
  const existing = await getCategory(categoryId, organizationId, deps);
  if (!existing) {
    throw httpError(`Categoría ${categoryId} no encontrada.`, 404);
  }
  const data: Partial<Pick<EmployeeCategoryRow, "name" | "description" | "active">> = {};
  if (payload.name !== undefined) data.name = String(payload.name).trim();
  if (payload.description !== undefined)
    data.description = payload.description ? String(payload.description).trim() : null;
  if (payload.active !== undefined) data.active = Boolean(payload.active);

  return deps.queries.updateCategoryRow(categoryId, data);
}

/** Soft-deletes a category (active=false). Org-scoped. */
export async function deactivateCategory(
  categoryId: number,
  organizationId: bigint | number,
  deps: EmployeeCategoryServiceDeps = defaultDeps,
): Promise<EmployeeCategoryRow> {
  const existing = await getCategory(categoryId, organizationId, deps);
  if (!existing) {
    throw httpError(`Categoría ${categoryId} no encontrada.`, 404);
  }
  return deps.queries.updateCategoryRow(categoryId, { active: false });
}
