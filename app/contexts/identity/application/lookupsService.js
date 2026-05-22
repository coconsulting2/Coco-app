/**
 * @module lookupsService
 * @description Use-cases de lookups para formularios admin. Wrapper sobre
 * el modelo Prisma (`lookupsModel`) que devuelve datos planos listos para
 * el componente AdminUserForm (camelCase → snake_case según el contrato
 * actual del formulario).
 */
import LookupsModel from "~/contexts/identity/infrastructure/lookupsModel.js";

/**
 * @returns {Promise<Array<{ id: number, name: string, is_system: boolean }>>}
 */
export async function listAvailableRoles() {
  const rows = await LookupsModel.listRoles();
  return rows.map((r) => ({
    id: r.roleId,
    name: r.roleName,
    is_system: r.isSystem ?? false,
  }));
}

/**
 * @returns {Promise<Array<{ id: number, name: string }>>}
 */
export async function listAvailableDepartments() {
  const rows = await LookupsModel.listDepartments();
  return rows.map((d) => ({
    id: d.departmentId,
    name: d.departmentName,
  }));
}
