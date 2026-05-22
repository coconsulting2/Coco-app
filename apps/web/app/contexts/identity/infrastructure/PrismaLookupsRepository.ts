/**
 * @module PrismaLookupsRepository
 * @description Adapter Prisma del port `LookupsRepository`. RLS-scoped via
 * tenant extension (el caller debe estar dentro de `runInTenant`).
 */
import prisma from "~/platform/db/prisma.server.js";
import type {
  LookupsRepository,
  RoleLookup,
  DepartmentLookup,
} from "~/contexts/identity/domain/ports/LookupsRepository.js";

export class PrismaLookupsRepository implements LookupsRepository {
  async listRoles(): Promise<RoleLookup[]> {
    const rows = await prisma.role.findMany({
      select: { roleId: true, roleName: true, isSystem: true },
      orderBy: { roleName: "asc" },
    });
    return rows.map((r) => ({
      roleId: r.roleId,
      roleName: r.roleName,
      isSystem: r.isSystem ?? false,
    }));
  }

  async listDepartments(): Promise<DepartmentLookup[]> {
    const rows = await prisma.department.findMany({
      select: { departmentId: true, departmentName: true },
      orderBy: { departmentName: "asc" },
    });
    return rows.map((d) => ({
      departmentId: d.departmentId,
      departmentName: d.departmentName,
    }));
  }

  async findRoleIdByName(roleName: string): Promise<number | null> {
    // roleName no es unique por sí solo (compound org_id + role_name); usamos
    // findFirst y dejamos que la tenant extension scope a la org activa.
    const row = await prisma.role.findFirst({
      where: { roleName },
      select: { roleId: true },
    });
    return row?.roleId ?? null;
  }

  async findDepartmentIdByName(departmentName: string): Promise<number | null> {
    const row = await prisma.department.findFirst({
      where: { departmentName },
      select: { departmentId: true },
    });
    return row?.departmentId ?? null;
  }
}
