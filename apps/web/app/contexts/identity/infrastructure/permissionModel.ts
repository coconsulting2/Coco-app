/**
 * @module permissionModel
 * @description Data-access layer for the granular permission system.
 * All Prisma queries live here so services stay free of ORM specifics.
 */
import { Prisma } from "@coco/db";
import prisma from "~/platform/db/prisma.server";
import { getTenantContext } from "~/platform/db/tenant-context.server";

/** Cliente Prisma extendido (web) o el handle transaccional interactivo. */
type PrismaLike = typeof prisma | Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const USER_WITH_PERMISSIONS_INCLUDE = {
  organization: {
    select: { kind: true },
  },
  role: {
    include: {
      rolePermissions: {
        include: { permission: true },
      },
      rolePermissionGroups: {
        include: {
          group: {
            include: {
              items: { include: { permission: true } },
            },
          },
        },
      },
    },
  },
  userPermissions: {
    include: { permission: true },
  },
  userPermissionGroups: {
    include: {
      group: {
        include: {
          items: { include: { permission: true } },
        },
      },
    },
  },
};

/**
 * Fetches a user with all their role permissions, role groups (and their items),
 * direct user permissions, and direct user groups (and their items). Used by
 * the permission service to compute the effective permission set.
 *
 * En rutas sin tenant (p. ej. POST /login justo tras autenticar), RLS bloquearía
 * la fila User; usamos transacción con bypass local solo en ese caso.
 *
 * @param {number} userId - Target user id
 * @returns {Promise<Object|null>} Nested user record or null
 */
export async function findUserWithPermissions(userId: number) {
  const q = (client: PrismaLike) =>
    client.user.findUnique({
      where: { userId },
      include: USER_WITH_PERMISSIONS_INCLUDE,
    });

  if (getTenantContext()) {
    return q(prisma);
  }

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.bypass_tenant', 'on', true)`;
    return q(tx);
  });
}

const ROLE_WITH_PERMISSIONS_INCLUDE = {
  organization: {
    select: { kind: true },
  },
  rolePermissions: {
    include: { permission: true },
  },
  rolePermissionGroups: {
    include: {
      group: {
        include: {
          items: { include: { permission: true } },
        },
      },
    },
  },
};

/**
 * Carga un rol con permisos directos y los de sus grupos (misma forma que en User.role).
 *
 * @param {number} roleId - Rol destino
 * @returns {Promise<Object|null>} Rol anidado o null
 */
export async function findRoleWithPermissions(roleId: number) {
  const q = (client: PrismaLike) =>
    client.role.findUnique({
      where: { roleId },
      include: ROLE_WITH_PERMISSIONS_INCLUDE,
    });

  if (getTenantContext()) {
    return q(prisma);
  }

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.bypass_tenant', 'on', true)`;
    return q(tx);
  });
}

/**
 * Lists permissions, optionally filtered by active flag.
 *
 * @param {Object} [options] - Filters
 * @param {boolean} [options.activeOnly=false] - If true, returns only active permissions
 * @returns {Promise<Array>} Array of Permission rows
 */
export const listPermissions = ({ activeOnly = false }: { activeOnly?: boolean } = {}) =>
  prisma.permission.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: [{ resource: "asc" }, { action: "asc" }],
  });

/**
 * Finds a permission by its unique code.
 *
 * @param {string} code - Permission code (e.g. "travel_request:approve")
 * @returns {Promise<Object|null>} Permission row or null
 */
export const findPermissionByCode = (code: string) =>
  prisma.permission.findUnique({ where: { code } });

/**
 * Creates a new permission entry.
 *
 * @param {Object} data - { code, resource, action, description? }
 * @returns {Promise<Object>} Created Permission row
 */
export const createPermission = (data: { code: string; resource: string; action: string; description?: string }) =>
  prisma.permission.create({ data });

/**
 * Updates an existing permission.
 *
 * @param {number} permissionId - Target permission id
 * @param {Object} data - Partial update
 * @returns {Promise<Object>} Updated Permission row
 */
export const updatePermission = (permissionId: number, data: Record<string, unknown>) =>
  prisma.permission.update({ where: { permissionId }, data });

/**
 * Soft-deletes a permission by setting active=false.
 *
 * @param {number} permissionId - Target permission id
 * @returns {Promise<Object>} Updated Permission row
 */
export const deactivatePermission = (permissionId: number) =>
  prisma.permission.update({ where: { permissionId }, data: { active: false } });

/**
 * Lists permission groups, including their member permissions.
 *
 * @returns {Promise<Array>} Array of PermissionGroup rows with items
 */
export const listPermissionGroups = () =>
  prisma.permissionGroup.findMany({
    orderBy: { groupName: "asc" },
    include: { items: { include: { permission: true } } },
  });

/**
 * Finds a permission group by id, including its members.
 *
 * @param {number} groupId - Target group id
 * @returns {Promise<Object|null>} Group row with items or null
 */
export const findPermissionGroup = (groupId: number) =>
  prisma.permissionGroup.findUnique({
    where: { groupId },
    include: { items: { include: { permission: true } } },
  });

/**
 * Creates a permission group.
 *
 * @param {Object} data - { groupName, description? }
 * @returns {Promise<Object>} Created group
 */
export const createPermissionGroup = (data: { groupName: string; description?: string }) =>
  // `organizationId` lo inyecta el tenantExtension en runtime sobre cada `create`.
  prisma.permissionGroup.create({
    data: data as Prisma.PermissionGroupCreateInput,
  });

/**
 * Updates a permission group.
 *
 * @param {number} groupId - Target group id
 * @param {Object} data - Partial update
 * @returns {Promise<Object>} Updated group
 */
export const updatePermissionGroup = (groupId: number, data: Record<string, unknown>) =>
  prisma.permissionGroup.update({ where: { groupId }, data });

/**
 * Soft-deletes a group.
 *
 * @param {number} groupId - Target group id
 * @returns {Promise<Object>} Updated group
 */
export const deactivatePermissionGroup = (groupId: number) =>
  prisma.permissionGroup.update({ where: { groupId }, data: { active: false } });

/**
 * Adds permissions to a group (idempotent via skipDuplicates).
 *
 * @param {number} groupId - Target group id
 * @param {number[]} permissionIds - Ids of permissions to add
 * @returns {Promise<Object>} createMany result
 */
export const addPermissionsToGroup = (groupId: number, permissionIds: number[]) =>
  prisma.permissionGroupItem.createMany({
    data: permissionIds.map((permissionId: number) => ({ groupId, permissionId })),
    skipDuplicates: true,
  });

/**
 * Removes a permission from a group.
 *
 * @param {number} groupId - Target group id
 * @param {number} permissionId - Permission id to remove
 * @returns {Promise<Object>} Deleted item
 */
export const removePermissionFromGroup = (groupId: number, permissionId: number) =>
  prisma.permissionGroupItem.delete({
    where: { groupId_permissionId: { groupId, permissionId } },
  });

/**
 * Adds permissions to a role.
 *
 * @param {number} roleId - Target role id
 * @param {number[]} permissionIds - Ids of permissions to add
 * @returns {Promise<Object>} createMany result
 */
export const addPermissionsToRole = (roleId: number, permissionIds: number[]) =>
  prisma.rolePermission.createMany({
    data: permissionIds.map((permissionId: number) => ({ roleId, permissionId })),
    skipDuplicates: true,
  });

/**
 * Removes a permission from a role.
 *
 * @param {number} roleId - Target role id
 * @param {number} permissionId - Permission id to remove
 * @returns {Promise<Object>} Deleted row
 */
export const removePermissionFromRole = (roleId: number, permissionId: number) =>
  prisma.rolePermission.delete({
    where: { roleId_permissionId: { roleId, permissionId } },
  });

/**
 * Adds permission groups to a role.
 *
 * @param {number} roleId - Target role id
 * @param {number[]} groupIds - Ids of groups to add
 * @returns {Promise<Object>} createMany result
 */
export const addGroupsToRole = (roleId: number, groupIds: number[]) =>
  prisma.rolePermissionGroup.createMany({
    data: groupIds.map((groupId: number) => ({ roleId, groupId })),
    skipDuplicates: true,
  });

/**
 * Removes a permission group from a role.
 *
 * @param {number} roleId - Target role id
 * @param {number} groupId - Group id to remove
 * @returns {Promise<Object>} Deleted row
 */
export const removeGroupFromRole = (roleId: number, groupId: number) =>
  prisma.rolePermissionGroup.delete({
    where: { roleId_groupId: { roleId, groupId } },
  });

/**
 * Adds permissions directly to a user (additive over role-derived set).
 *
 * @param {number} userId - Target user id
 * @param {number[]} permissionIds - Ids of permissions to add
 * @returns {Promise<Object>} createMany result
 */
export const addPermissionsToUser = (userId: number, permissionIds: number[]) =>
  // `organizationId` lo inyecta el tenantExtension en runtime sobre cada `createMany`.
  prisma.userPermission.createMany({
    data: permissionIds.map(
      (permissionId: number) =>
        ({ userId, permissionId }) as Prisma.UserPermissionCreateManyInput,
    ),
    skipDuplicates: true,
  });

/**
 * Removes a direct permission grant from a user.
 *
 * @param {number} userId - Target user id
 * @param {number} permissionId - Permission id
 * @returns {Promise<Object>} Deleted row
 */
export const removePermissionFromUser = (userId: number, permissionId: number) =>
  prisma.userPermission.delete({
    where: { userId_permissionId: { userId, permissionId } },
  });

/**
 * Adds permission groups directly to a user (additive).
 *
 * @param {number} userId - Target user id
 * @param {number[]} groupIds - Group ids
 * @returns {Promise<Object>} createMany result
 */
export const addGroupsToUser = (userId: number, groupIds: number[]) =>
  // `organizationId` lo inyecta el tenantExtension en runtime sobre cada `createMany`.
  prisma.userPermissionGroup.createMany({
    data: groupIds.map(
      (groupId: number) =>
        ({ userId, groupId }) as Prisma.UserPermissionGroupCreateManyInput,
    ),
    skipDuplicates: true,
  });

/**
 * Removes a permission group directly assigned to a user.
 *
 * @param {number} userId - Target user id
 * @param {number} groupId - Group id
 * @returns {Promise<Object>} Deleted row
 */
export const removeGroupFromUser = (userId: number, groupId: number) =>
  prisma.userPermissionGroup.delete({
    where: { userId_groupId: { userId, groupId } },
  });

// ─── Tenant roles (CRUD) ─────────────────────────────────────────────────────

/**
 * Lista roles del tenant actual (RLS + extensión de tenant) con conteo de usuarios activos
 * y asignaciones de permisos directos + vía grupos.
 *
 * @returns {Promise<Array>}
 */
export const listRolesWithAssignments = () =>
  prisma.role.findMany({
    orderBy: { roleName: "asc" },
    include: {
      _count: {
        select: {
          users: { where: { active: true } },
        },
      },
      rolePermissions: { include: { permission: true } },
      rolePermissionGroups: {
        include: {
          group: {
            include: {
              items: { include: { permission: true } },
            },
          },
        },
      },
    },
  });
