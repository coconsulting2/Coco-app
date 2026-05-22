/**
 * @module listLookups
 * @description Use-cases para lookups (roles + departments). Tenant-scoped
 * por el caller (`runInTenant`).
 */
import type {
  LookupsRepository,
  RoleLookup,
  DepartmentLookup,
} from "~/contexts/identity/domain/ports/LookupsRepository.js";

export type RoleOption = { id: number; name: string; is_system: boolean };
export type DepartmentOption = { id: number; name: string };

export type ListLookupsDeps = { lookupsRepo: LookupsRepository };

export async function listAvailableRoles(
  deps: ListLookupsDeps,
): Promise<RoleOption[]> {
  const rows: RoleLookup[] = await deps.lookupsRepo.listRoles();
  return rows.map((r) => ({ id: r.roleId, name: r.roleName, is_system: r.isSystem }));
}

export async function listAvailableDepartments(
  deps: ListLookupsDeps,
): Promise<DepartmentOption[]> {
  const rows: DepartmentLookup[] = await deps.lookupsRepo.listDepartments();
  return rows.map((d) => ({ id: d.departmentId, name: d.departmentName }));
}
