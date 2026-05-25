/**
 * @module EmployeeCategoryQueriesPort
 * @description Puerto de acceso a datos para CRUD de categorías de empleado.
 * Implementado por el adapter Prisma en `infrastructure/employeeCategoryQueries`.
 */
import type { EmployeeCategoryRow } from "~/contexts/policies/domain/types";

export interface EmployeeCategoryQueriesPort {
  listCategoriesForOrg(
    organizationId: bigint | number,
    opts?: { activeOnly?: boolean },
  ): Promise<EmployeeCategoryRow[]>;
  findCategoryById(categoryId: number): Promise<EmployeeCategoryRow | null>;
  createCategoryRow(data: {
    organizationId: bigint | number;
    code: string;
    name: string;
    description: string | null;
    active: boolean;
  }): Promise<EmployeeCategoryRow>;
  updateCategoryRow(
    categoryId: number,
    data: Partial<Pick<EmployeeCategoryRow, "name" | "description" | "active">>,
  ): Promise<EmployeeCategoryRow>;
}
