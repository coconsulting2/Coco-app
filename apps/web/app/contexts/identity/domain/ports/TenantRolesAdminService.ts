/**
 * @module TenantRolesAdminService
 * @description Puerto para administración de Tenant Roles + Permission
 * Groups dentro de una org. El adapter por defecto wrappea
 * `platform/permissions/permission-service.server.js` (legacy JS aún sin
 * migrar; conversión completa a hex es Wave 6 del CLEANUP_PLAN).
 */
export type TenantRoleRow = {
  id: number;
  name: string;
  description: string | null;
  permissions: TenantRolePermissionRow[];
  permissionGroups: TenantRolePermissionGroupRow[];
};

export type TenantRolePermissionRow = {
  id: number;
  code: string;
  resource: string;
  description: string | null;
};

export type TenantRolePermissionGroupRow = {
  id: number;
  name: string;
  description: string | null;
};

export type RbacPermissionRow = {
  id: number;
  code: string;
  resource: string;
  description: string | null;
};

export type RbacPermissionGroupRow = {
  id: number;
  name: string;
  description: string | null;
};

/**
 * Vista serializada de un rol del tenant para la UI de admin. Coincide 1:1 con
 * el row que produce `permissionService.serializeRoleRow` (legacy parity) y con
 * el tipo `Role` que consume `shared/ui/RolesAdmin`.
 */
export type TenantRoleAdminRow = {
  role_id: number;
  name: string;
  permissions: string[];
  max_authorization_amount: number | null;
  expiration_date: string | null;
  is_admin: boolean;
  active_users_count: number;
  is_system: boolean;
};

/** Payload de creación de un rol personalizado (paridad con el body legacy). */
export type CreateTenantRoleInput = {
  name: string;
  permissions: string[];
  max_authorization_amount: number | null;
  expiration_date: string | null;
  is_admin: boolean;
};

/**
 * Payload de actualización. Para roles de sistema solo se respeta
 * `max_authorization_amount`; el resto de campos los valida/ignora el servicio.
 */
export type UpdateTenantRoleInput = {
  name?: string;
  permissions?: string[];
  max_authorization_amount?: number | null;
  expiration_date?: string | null;
  is_admin?: boolean;
};

export interface TenantRolesAdminService {
  listTenantRolesForAdmin(): Promise<TenantRoleRow[]>;
  listRbacPermissions(): Promise<RbacPermissionRow[]>;
  listRbacPermissionGroups(): Promise<RbacPermissionGroupRow[]>;
  createTenantRole(input: CreateTenantRoleInput): Promise<TenantRoleAdminRow>;
  updateTenantRole(
    roleId: number,
    input: UpdateTenantRoleInput,
  ): Promise<TenantRoleAdminRow>;
  deleteTenantRole(roleId: number): Promise<void>;
}
