/**
 * Unit tests de los use-cases de catálogos auxiliares (departamentos + roles)
 * con stub in-memory del port `WorkflowReferenceRepository` — sin DB.
 */
import { describe, it, expect, vi } from "vitest";
import {
  listDepartments,
  listRoleNames,
} from "~/contexts/workflow/application/manageWorkflowReferences";
import type { WorkflowReferenceRepository } from "~/contexts/workflow/domain/ports/WorkflowReferenceRepository";

function makeRepo(
  over: Partial<WorkflowReferenceRepository> = {},
): WorkflowReferenceRepository {
  return {
    listDepartments: async () => [
      { departmentId: 1, departmentName: "Finanzas", costsCenter: "CC-01" },
    ],
    listRoleNames: async () => ["N1", "N2"],
    ...over,
  };
}

describe("manageWorkflowReferences", () => {
  it("listDepartments delega con el orgId", async () => {
    const spy = vi.fn(async () => [
      { departmentId: 1, departmentName: "Finanzas", costsCenter: null },
    ]);
    const out = await listDepartments(101n, { references: makeRepo({ listDepartments: spy }) });
    expect(spy).toHaveBeenCalledWith(101n);
    expect(out[0]?.departmentName).toBe("Finanzas");
  });

  it("listRoleNames delega con el orgId", async () => {
    const spy = vi.fn(async () => ["N1", "N2", "Administrador"]);
    const out = await listRoleNames(202n, { references: makeRepo({ listRoleNames: spy }) });
    expect(spy).toHaveBeenCalledWith(202n);
    expect(out).toContain("Administrador");
  });
});
