/**
 * @module manageWorkflowReferences
 * @description Use-cases de catálogos auxiliares del panel admin de workflow
 * (departamentos activos + roles del tenant). Deps por DI vía el port
 * `WorkflowReferenceRepository`.
 */
import type { WorkflowReferenceRepository } from "~/contexts/workflow/domain/ports/WorkflowReferenceRepository.js";
import type { WorkflowDepartment } from "~/contexts/workflow/domain/entities/WorkflowReference.js";

export type ManageReferencesDeps = { references: WorkflowReferenceRepository };

export async function listDepartments(
  organizationId: bigint,
  deps: ManageReferencesDeps,
): Promise<WorkflowDepartment[]> {
  return deps.references.listDepartments(organizationId);
}

export async function listRoleNames(
  organizationId: bigint,
  deps: ManageReferencesDeps,
): Promise<string[]> {
  return deps.references.listRoleNames(organizationId);
}
