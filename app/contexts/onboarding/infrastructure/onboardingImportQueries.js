/**
 * @module onboardingImportQueries
 * @description Queries Prisma extraídas de onboardingImportService (Fase 6).
 * Cada función envuelve una operación específica del flujo de importación
 * (preview, apply, bootstrap admin, manager links).
 */
import prisma from "~/platform/db/prisma.server.js";

/**
 * @param {bigint | number} organizationId
 * @param {string} roleName
 */
export async function findRoleByNameInOrg(organizationId, roleName) {
  return prisma.role.findFirst({
    where: { organizationId, roleName },
    select: { roleId: true },
  });
}

/**
 * @param {number} roleId
 */
export async function findRoleByIdForTemplate(roleId) {
  return prisma.role.findUnique({
    where: { roleId: Number(roleId) },
    select: { maxApprovalAmount: true, organizationId: true },
  });
}

/**
 * @param {string[]} codes
 */
export async function findActivePermissionsByCodes(codes) {
  return prisma.permission.findMany({
    where: { code: { in: codes }, active: true },
    select: { permissionId: true, code: true },
  });
}

/**
 * @param {object} data
 */
export async function createImportCustomRole(data) {
  return prisma.role.create({
    data,
    select: { roleId: true, roleName: true },
  });
}

/**
 * @param {Array<{ roleId: number; permissionId: number }>} rows
 */
export async function attachPermissionsToRole(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return;
  return prisma.rolePermission.createMany({
    data: rows,
    skipDuplicates: true,
  });
}

/**
 * @param {bigint} organizationId
 */
export async function listRolesByOrg(organizationId) {
  return prisma.role.findMany({
    where: { organizationId },
    select: { roleName: true, roleId: true },
  });
}

/**
 * @param {string[]} userNames
 * @param {bigint} organizationId
 */
export async function findExistingUsersByUsername(userNames, organizationId) {
  return prisma.user.findMany({
    where: { userName: { in: userNames }, organizationId },
    select: { userName: true },
  });
}

/**
 * @param {string[]} emails
 */
export async function findExistingUsersByEmail(emails) {
  return prisma.user.findMany({
    where: { email: { in: emails } },
    select: { email: true },
  });
}

/**
 * @param {object} data
 */
export async function createImportedUser(data) {
  return prisma.user.create({
    data,
    select: { userId: true, userName: true, email: true },
  });
}

/**
 * @param {{ where: object; create: object; update: object }} args
 */
export async function upsertEmpleadoForImport({ where, create, update }) {
  return prisma.empleado.upsert({ where, create, update });
}

/**
 * @param {number} userId
 * @param {object} data
 */
export async function updateUserPartial(userId, data) {
  return prisma.user.update({
    where: { userId: Number(userId) },
    data,
  });
}

/**
 * @param {Array<{ userId: number; permissionId: number; organizationId: bigint }>} rows
 */
export async function grantUserPermissions(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return;
  return prisma.userPermission.createMany({
    data: rows,
    skipDuplicates: true,
  });
}

/**
 * @param {bigint} organizationId
 * @param {string[]} noEmpleadosToFind
 */
export async function findManagersByNoEmpleado(organizationId, noEmpleadosToFind) {
  return prisma.user.findMany({
    where: { organizationId, noEmpleado: { in: noEmpleadosToFind } },
    select: { userId: true, noEmpleado: true },
  });
}

/**
 * @param {bigint} organizationId
 * @param {string[]} userNames
 */
export async function findUsersByUsernameInOrg(organizationId, userNames) {
  return prisma.user.findMany({
    where: { organizationId, userName: { in: userNames } },
    select: { userId: true, userName: true },
  });
}

/**
 * @param {bigint} organizationId
 */
export async function findAdminRoleInOrg(organizationId) {
  return prisma.role.findFirst({
    where: { organizationId, roleName: "Administrador" },
  });
}

/**
 * @param {bigint} organizationId
 * @param {number} roleId
 */
export async function findExistingAdminUser(organizationId, roleId) {
  return prisma.user.findFirst({ where: { organizationId, roleId } });
}

/**
 * Catalog upserts: AccountingSociety + Department (utilizados durante apply).
 *
 * @param {{ organizationId: bigint; code: string; name: string }} args
 */
export async function upsertAccountingSociety({ organizationId, code, name }) {
  return prisma.accountingSociety.upsert({
    where: { organizationId_code: { organizationId, code } },
    create: { organizationId, code, name },
    update: { name },
  });
}

/**
 * @param {{ organizationId: bigint; departmentName: string; costsCenter: string | null; societyId: number | undefined }} args
 */
export async function upsertDepartmentForImport({
  organizationId,
  departmentName,
  costsCenter,
  societyId,
}) {
  return prisma.department.upsert({
    where: { organizationId_departmentName: { organizationId, departmentName } },
    create: { organizationId, departmentName, costsCenter, societyId },
    update: { costsCenter, societyId },
  });
}
