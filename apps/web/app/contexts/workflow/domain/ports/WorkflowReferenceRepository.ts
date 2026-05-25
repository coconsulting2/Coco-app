/**
 * @module WorkflowReferenceRepository
 * @description Puerto de catálogos auxiliares del panel admin de workflow
 * (departamentos activos + nombres de roles del tenant). Las queries Prisma
 * viven en `infrastructure/PrismaWorkflowReferenceRepository.ts`.
 */
import type { WorkflowDepartment } from "~/contexts/workflow/domain/entities/WorkflowReference.js";

export interface WorkflowReferenceRepository {
  /** Departamentos activos de la organización (orden alfabético). */
  listDepartments(organizationId: bigint): Promise<WorkflowDepartment[]>;

  /** Nombres de roles de la organización (orden alfabético). */
  listRoleNames(organizationId: bigint): Promise<string[]>;
}
