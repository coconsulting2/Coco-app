/**
 * @module lookupsModel
 * @description Repositorio de lookups que el formulario de crear/editar usuario
 * necesita: lista de roles y departamentos del tenant. Vive en `infrastructure/`
 * porque toca Prisma directo (la regla anti-fuga lo permite aquí).
 *
 * La RLS de Postgres + tenant-extension de Prisma filtran automáticamente
 * por `organizationId` cuando se invoca dentro de `runInTenant(session, ...)`.
 */
import prisma from "~/platform/db/prisma.server.js";

/**
 * Lista los roles disponibles en el tenant activo. RLS-scoped.
 * @returns {Promise<Array<{ roleId: number, roleName: string, isSystem: boolean }>>}
 */
export async function listRoles() {
  return prisma.role.findMany({
    select: { roleId: true, roleName: true, isSystem: true },
    orderBy: { roleName: "asc" },
  });
}

/**
 * Lista los departamentos del tenant activo. RLS-scoped.
 * @returns {Promise<Array<{ departmentId: number, departmentName: string }>>}
 */
export async function listDepartments() {
  return prisma.department.findMany({
    select: { departmentId: true, departmentName: true },
    orderBy: { departmentName: "asc" },
  });
}

export default { listRoles, listDepartments };
