/**
 * @module onboardingImportQueries
 * @description Queries Prisma extraídas de onboardingImportService.
 * Cada función envuelve una operación específica del flujo de importación
 * (preview, apply, bootstrap admin, manager links). Prisma vive solo aquí.
 */
import prisma from "~/platform/db/prisma.server.js";
import type { Prisma } from "@coco/db";

export async function findRoleByNameInOrg(
  organizationId: bigint | number,
  roleName: string,
): Promise<{ roleId: number } | null> {
  return prisma.role.findFirst({
    where: { organizationId, roleName },
    select: { roleId: true },
  });
}

export async function findRoleByIdForTemplate(
  roleId: number,
): Promise<{ maxApprovalAmount: number | null; organizationId: bigint } | null> {
  return prisma.role.findUnique({
    where: { roleId: Number(roleId) },
    select: { maxApprovalAmount: true, organizationId: true },
  });
}

export async function findActivePermissionsByCodes(
  codes: string[],
): Promise<Array<{ permissionId: number; code: string }>> {
  return prisma.permission.findMany({
    where: { code: { in: codes }, active: true },
    select: { permissionId: true, code: true },
  });
}

export type CreateImportCustomRoleData = {
  organizationId: bigint;
  roleName: string;
  maxApprovalAmount: number | null;
  isSystem: boolean;
};

export async function createImportCustomRole(
  data: CreateImportCustomRoleData,
): Promise<{ roleId: number; roleName: string }> {
  return prisma.role.create({
    data,
    select: { roleId: true, roleName: true },
  });
}

export async function attachPermissionsToRole(
  rows: Array<{ roleId: number; permissionId: number }>,
): Promise<void> {
  if (!Array.isArray(rows) || rows.length === 0) return;
  await prisma.rolePermission.createMany({ data: rows, skipDuplicates: true });
}

export async function listRolesByOrg(
  organizationId: bigint,
): Promise<Array<{ roleName: string; roleId: number }>> {
  return prisma.role.findMany({
    where: { organizationId },
    select: { roleName: true, roleId: true },
  });
}

export async function findExistingUsersByUsername(
  userNames: string[],
  organizationId: bigint,
): Promise<Array<{ userName: string }>> {
  return prisma.user.findMany({
    where: { userName: { in: userNames }, organizationId },
    select: { userName: true },
  });
}

export async function findExistingUsersByEmail(
  emails: string[],
): Promise<Array<{ email: string }>> {
  return prisma.user.findMany({
    where: { email: { in: emails } },
    select: { email: true },
  });
}

export type CreateImportedUserData = {
  organizationId: bigint;
  roleId: number;
  userName: string;
  password: string;
  email: string;
  workstation: string;
  departmentId?: number;
  active: boolean;
};

export async function createImportedUser(
  data: CreateImportedUserData,
): Promise<{ userId: number; userName: string; email: string }> {
  return prisma.user.create({
    data,
    select: { userId: true, userName: true, email: true },
  });
}

export async function upsertEmpleadoForImport(args: {
  where: Prisma.EmpleadoWhereUniqueInput;
  create: Prisma.EmpleadoUncheckedCreateInput;
  update: Prisma.EmpleadoUncheckedUpdateInput;
}): Promise<unknown> {
  const { where, create, update } = args;
  return prisma.empleado.upsert({ where, create, update });
}

export async function updateUserPartial(
  userId: number,
  data: Prisma.UserUncheckedUpdateInput,
): Promise<unknown> {
  return prisma.user.update({ where: { userId: Number(userId) }, data });
}

export async function grantUserPermissions(
  rows: Array<{ userId: number; permissionId: number; organizationId: bigint }>,
): Promise<void> {
  if (!Array.isArray(rows) || rows.length === 0) return;
  await prisma.userPermission.createMany({ data: rows, skipDuplicates: true });
}

export async function findManagersByNoEmpleado(
  organizationId: bigint,
  noEmpleadosToFind: string[],
): Promise<Array<{ userId: number; noEmpleado: string | null }>> {
  return prisma.user.findMany({
    where: { organizationId, noEmpleado: { in: noEmpleadosToFind } },
    select: { userId: true, noEmpleado: true },
  });
}

export async function findUsersByUsernameInOrg(
  organizationId: bigint,
  userNames: string[],
): Promise<Array<{ userId: number; userName: string }>> {
  return prisma.user.findMany({
    where: { organizationId, userName: { in: userNames } },
    select: { userId: true, userName: true },
  });
}

export async function findAdminRoleInOrg(
  organizationId: bigint,
): Promise<{ roleId: number } | null> {
  return prisma.role.findFirst({
    where: { organizationId, roleName: "Administrador" },
    select: { roleId: true },
  });
}

export async function findExistingAdminUser(
  organizationId: bigint,
  roleId: number,
): Promise<{ userId: number } | null> {
  return prisma.user.findFirst({
    where: { organizationId, roleId },
    select: { userId: true },
  });
}

export async function upsertAccountingSociety(args: {
  organizationId: bigint;
  code: string;
  name: string;
}): Promise<{ societyId: bigint }> {
  const { organizationId, code, name } = args;
  return prisma.accountingSociety.upsert({
    where: { organizationId_code: { organizationId, code } },
    create: { organizationId, code, name },
    update: { name },
    select: { societyId: true },
  });
}

export async function upsertDepartmentForImport(args: {
  organizationId: bigint;
  departmentName: string;
  costsCenter: string | null;
  societyId: bigint | undefined;
}): Promise<{ departmentId: number; departmentName: string; costsCenter: string | null }> {
  const { organizationId, departmentName, costsCenter, societyId } = args;
  return prisma.department.upsert({
    where: { organizationId_departmentName: { organizationId, departmentName } },
    create: { organizationId, departmentName, costsCenter, societyId },
    update: { costsCenter, societyId },
    select: { departmentId: true, departmentName: true, costsCenter: true },
  });
}
