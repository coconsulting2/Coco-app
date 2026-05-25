/**
 * Unit tests del `employeeCategoryService` con stub del puerto
 * EmployeeCategoryQueriesPort — sin DB. Cubre org-scoping, normalización,
 * mapeo de P2002 → 409 y soft-delete.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("~/platform/logger/log/logger.js", () => ({
  Logger: () => ({ info() {}, warn() {}, error() {}, trace() {}, debug() {} }),
}));

vi.mock("~/contexts/policies/infrastructure/employeeCategoryQueries.js", () => ({
  prismaEmployeeCategoryQueries: {},
}));

import {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deactivateCategory,
  type EmployeeCategoryServiceDeps,
} from "~/contexts/policies/application/employeeCategoryService";
import type { EmployeeCategoryQueriesPort } from "~/contexts/policies/domain/ports/EmployeeCategoryQueriesPort";
import type { EmployeeCategoryRow } from "~/contexts/policies/domain/types";

function makeCat(overrides: Partial<EmployeeCategoryRow> = {}): EmployeeCategoryRow {
  return {
    categoryId: 1,
    organizationId: 100,
    code: "EXEC",
    name: "Ejecutivo",
    description: null,
    active: true,
    ...overrides,
  };
}

function stub(over: Partial<EmployeeCategoryQueriesPort> = {}): EmployeeCategoryQueriesPort {
  return {
    listCategoriesForOrg: vi.fn(async () => [makeCat()]),
    findCategoryById: vi.fn(async () => null),
    createCategoryRow: vi.fn(async (d) => makeCat({ code: d.code, name: d.name })),
    updateCategoryRow: vi.fn(async (id, d) => makeCat({ categoryId: id, ...d })),
    ...over,
  };
}

function deps(over: Partial<EmployeeCategoryQueriesPort> = {}): EmployeeCategoryServiceDeps {
  return { queries: stub(over) };
}

describe("employeeCategoryService", () => {
  it("lists categories for org", async () => {
    const result = await listCategories(100, {}, deps());
    expect(result).toHaveLength(1);
  });

  it("getCategory returns null on org mismatch", async () => {
    const findCategoryById = vi.fn(async () => makeCat({ organizationId: 999 }));
    expect(await getCategory(1, 100, deps({ findCategoryById }))).toBeNull();
  });

  it("createCategory trims fields and defaults active", async () => {
    const createCategoryRow = vi.fn(async (d) => makeCat({ code: d.code }));
    await createCategory(100, { code: "  exec ", name: " Ejecutivo " }, deps({ createCategoryRow }));
    const data = createCategoryRow.mock.calls[0]![0];
    expect(data.code).toBe("exec");
    expect(data.name).toBe("Ejecutivo");
    expect(data.active).toBe(true);
  });

  it("createCategory maps P2002 to status 409", async () => {
    const createCategoryRow = vi.fn(async () => {
      throw Object.assign(new Error("dup"), { code: "P2002" });
    });
    await expect(
      createCategory(100, { code: "DUP", name: "x" }, deps({ createCategoryRow })),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("updateCategory throws 404 when not found", async () => {
    await expect(updateCategory(1, 100, { name: "z" }, deps())).rejects.toMatchObject({ status: 404 });
  });

  it("deactivateCategory sets active=false", async () => {
    const findCategoryById = vi.fn(async () => makeCat({ organizationId: 100 }));
    const updateCategoryRow = vi.fn(async (id, d) => makeCat({ categoryId: id, ...d }));
    await deactivateCategory(1, 100, deps({ findCategoryById, updateCategoryRow }));
    expect(updateCategoryRow).toHaveBeenCalledWith(1, { active: false });
  });
});
