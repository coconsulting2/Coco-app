/**
 * @module listAdminRolesCatalog
 * @description Use-case puro (DI) que carga TODA la data inicial necesaria
 * para la pantalla admin/roles: la lista de tenant roles + el catálogo
 * de permisos RBAC + el catálogo de permission groups. Lo consumen
 * loaders SSR para evitar el round-trip cliente → API que el legacy hacía.
 */
import type {
  TenantRolesAdminService,
  TenantRoleRow,
  RbacPermissionRow,
  RbacPermissionGroupRow,
} from "~/contexts/identity/domain/ports/TenantRolesAdminService.js";

export type ListAdminRolesCatalogDeps = { service: TenantRolesAdminService };

export type ListAdminRolesCatalogResult = {
  roles: TenantRoleRow[];
  permissions: RbacPermissionRow[];
  permissionGroups: RbacPermissionGroupRow[];
};

export async function listAdminRolesCatalog(
  deps: ListAdminRolesCatalogDeps,
): Promise<ListAdminRolesCatalogResult> {
  const [roles, permissions, permissionGroups] = await Promise.all([
    deps.service.listTenantRolesForAdmin(),
    deps.service.listRbacPermissions(),
    deps.service.listRbacPermissionGroups(),
  ]);
  return { roles, permissions, permissionGroups };
}
