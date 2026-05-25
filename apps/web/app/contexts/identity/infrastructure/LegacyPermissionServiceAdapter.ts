/**
 * @module LegacyPermissionServiceAdapter
 * @description Adapter para el port `TenantRolesAdminService`. Wrappea las
 * funciones legacy de `platform/permissions/permission-service.server.js`
 * (JS sin tipos — ambient declarado en `types/legacy-js.d.ts`).
 *
 * Conversión completa de `permission-service.server.js` a TS hex es Wave 6
 * del CLEANUP_PLAN; este adapter es la frontera estable mientras tanto.
 */
import * as permissionService from "~/platform/permissions/permission-service.server.js";
import type {
  TenantRolesAdminService,
  TenantRoleRow,
  TenantRoleAdminRow,
  CreateTenantRoleInput,
  UpdateTenantRoleInput,
  RbacPermissionRow,
  RbacPermissionGroupRow,
} from "~/contexts/identity/domain/ports/TenantRolesAdminService.js";

type LegacyPermissionService = {
  listTenantRolesForAdmin(): Promise<unknown[]>;
  getPermissions(): Promise<unknown[]>;
  getPermissionGroups(): Promise<unknown[]>;
  createTenantRole(payload: unknown): Promise<unknown>;
  updateTenantRole(roleId: number, payload: unknown): Promise<unknown>;
  deleteTenantRole(roleId: number): Promise<void>;
};

function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string") return Number(v);
  return 0;
}

function toStr(v: unknown): string {
  if (typeof v === "string") return v;
  if (v == null) return "";
  return String(v);
}

function toStrOrNull(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v;
  return String(v);
}

type RawPermission = {
  id?: unknown;
  permission_id?: unknown;
  code?: unknown;
  resource?: unknown;
  description?: unknown;
};

type RawGroup = {
  id?: unknown;
  permission_group_id?: unknown;
  name?: unknown;
  description?: unknown;
};

type RawRole = {
  id?: unknown;
  role_id?: unknown;
  name?: unknown;
  role_name?: unknown;
  description?: unknown;
  permissions?: RawPermission[];
  permission_groups?: RawGroup[];
};

function mapPermission(p: RawPermission): RbacPermissionRow {
  return {
    id: toNum(p.id ?? p.permission_id),
    code: toStr(p.code),
    resource: toStr(p.resource),
    description: toStrOrNull(p.description),
  };
}

function mapGroup(g: RawGroup): RbacPermissionGroupRow {
  return {
    id: toNum(g.id ?? g.permission_group_id),
    name: toStr(g.name),
    description: toStrOrNull(g.description),
  };
}

function mapRole(r: RawRole): TenantRoleRow {
  return {
    id: toNum(r.id ?? r.role_id),
    name: toStr(r.name ?? r.role_name),
    description: toStrOrNull(r.description),
    permissions: (r.permissions ?? []).map(mapPermission),
    permissionGroups: (r.permission_groups ?? []).map(mapGroup),
  };
}

type RawAdminRoleRow = {
  role_id?: unknown;
  name?: unknown;
  permissions?: unknown;
  max_authorization_amount?: unknown;
  expiration_date?: unknown;
  is_admin?: unknown;
  active_users_count?: unknown;
  is_system?: unknown;
};

function toNumOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Mapea el row serializado por `permissionService.serializeRoleRow` (legacy) al
 * `TenantRoleAdminRow` tipado del puerto. Paridad 1:1 con los campos que el
 * controller legacy devolvía a `RolesAdmin`.
 */
function mapAdminRoleRow(r: RawAdminRoleRow): TenantRoleAdminRow {
  return {
    role_id: toNum(r.role_id),
    name: toStr(r.name),
    permissions: Array.isArray(r.permissions) ? r.permissions.map(toStr) : [],
    max_authorization_amount: toNumOrNull(r.max_authorization_amount),
    expiration_date: toStrOrNull(r.expiration_date),
    is_admin: Boolean(r.is_admin),
    active_users_count: toNum(r.active_users_count),
    is_system: Boolean(r.is_system),
  };
}

export class LegacyPermissionServiceAdapter implements TenantRolesAdminService {
  async listTenantRolesForAdmin(): Promise<TenantRoleRow[]> {
    const svc = permissionService as unknown as LegacyPermissionService;
    const raw = (await svc.listTenantRolesForAdmin()) as RawRole[];
    return (raw ?? []).map(mapRole);
  }

  async listRbacPermissions(): Promise<RbacPermissionRow[]> {
    const svc = permissionService as unknown as LegacyPermissionService;
    const raw = (await svc.getPermissions()) as RawPermission[];
    return (raw ?? []).map(mapPermission);
  }

  async listRbacPermissionGroups(): Promise<RbacPermissionGroupRow[]> {
    const svc = permissionService as unknown as LegacyPermissionService;
    const raw = (await svc.getPermissionGroups()) as RawGroup[];
    return (raw ?? []).map(mapGroup);
  }

  async createTenantRole(input: CreateTenantRoleInput): Promise<TenantRoleAdminRow> {
    const svc = permissionService as unknown as LegacyPermissionService;
    const raw = (await svc.createTenantRole(input)) as RawAdminRoleRow;
    return mapAdminRoleRow(raw);
  }

  async updateTenantRole(
    roleId: number,
    input: UpdateTenantRoleInput,
  ): Promise<TenantRoleAdminRow> {
    const svc = permissionService as unknown as LegacyPermissionService;
    const raw = (await svc.updateTenantRole(roleId, input)) as RawAdminRoleRow;
    return mapAdminRoleRow(raw);
  }

  async deleteTenantRole(roleId: number): Promise<void> {
    const svc = permissionService as unknown as LegacyPermissionService;
    await svc.deleteTenantRole(roleId);
  }
}
