/**
 * @module LookupsRepository
 * @description Puerto para lookups de catálogo del tenant (roles, departments).
 * Lo consume el formulario de crear/editar usuario y otros admin views.
 */

export type RoleLookup = {
  roleId: number;
  roleName: string;
  isSystem: boolean;
};

export type DepartmentLookup = {
  departmentId: number;
  departmentName: string;
};

export interface LookupsRepository {
  listRoles(): Promise<RoleLookup[]>;
  listDepartments(): Promise<DepartmentLookup[]>;
  /** Resuelve roleId por nombre (admin import / update). null si no existe. */
  findRoleIdByName(roleName: string): Promise<number | null>;
  /** Resuelve departmentId por nombre. null si no existe. */
  findDepartmentIdByName(departmentName: string): Promise<number | null>;
}
