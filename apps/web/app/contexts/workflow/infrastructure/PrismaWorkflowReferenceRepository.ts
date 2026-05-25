/**
 * @module PrismaWorkflowReferenceRepository
 * @description Adapter Prisma del puerto `WorkflowReferenceRepository`. Provee
 * los catálogos auxiliares (departamentos activos + roles) que el panel admin
 * de workflow usa. ÚNICO sitio acoplado a Prisma para estos catálogos.
 */
import prisma from "~/platform/db/prisma.server.js";
import type { WorkflowReferenceRepository } from "~/contexts/workflow/domain/ports/WorkflowReferenceRepository.js";
import type { WorkflowDepartment } from "~/contexts/workflow/domain/entities/WorkflowReference.js";

export class PrismaWorkflowReferenceRepository
  implements WorkflowReferenceRepository
{
  async listDepartments(organizationId: bigint): Promise<WorkflowDepartment[]> {
    const rows = await prisma.department.findMany({
      where: { organizationId, active: true },
      select: { departmentId: true, departmentName: true, costsCenter: true },
      orderBy: { departmentName: "asc" },
    });
    return rows.map((r) => ({
      departmentId: r.departmentId,
      departmentName: r.departmentName,
      costsCenter: r.costsCenter ?? null,
    }));
  }

  async listRoleNames(organizationId: bigint): Promise<string[]> {
    const rows = await prisma.role.findMany({
      where: { organizationId },
      select: { roleName: true },
      orderBy: { roleName: "asc" },
    });
    return rows.map((r) => r.roleName);
  }
}
