/**
 * @module manageTenantRoles
 * @description Use-cases puros (DI) para el CRUD de tenant roles desde la
 * pantalla admin/roles: crear, actualizar y eliminar roles personalizados.
 * Toda la lógica de negocio (validación de nombre, flag admin, roles de
 * sistema, monto máximo, usuarios activos) vive detrás del puerto
 * `TenantRolesAdminService` (adapter wrappea el servicio legacy mientras la
 * conversión hex completa es Wave 6). Estos use-cases solo orquestan + DI,
 * permitiendo inyectar stubs en tests.
 */
import type {
  TenantRolesAdminService,
  TenantRoleAdminRow,
  CreateTenantRoleInput,
  UpdateTenantRoleInput,
} from "~/contexts/identity/domain/ports/TenantRolesAdminService.js";

export type ManageTenantRolesDeps = { service: TenantRolesAdminService };

export function createTenantRole(
  input: CreateTenantRoleInput,
  deps: ManageTenantRolesDeps,
): Promise<TenantRoleAdminRow> {
  return deps.service.createTenantRole(input);
}

export function updateTenantRole(
  roleId: number,
  input: UpdateTenantRoleInput,
  deps: ManageTenantRolesDeps,
): Promise<TenantRoleAdminRow> {
  return deps.service.updateTenantRole(roleId, input);
}

export function deleteTenantRole(
  roleId: number,
  deps: ManageTenantRolesDeps,
): Promise<void> {
  return deps.service.deleteTenantRole(roleId);
}
