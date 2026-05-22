/**
 * @module User
 * @description Entidad de dominio del slice identity. Es la representación
 * lógica del usuario tal como la lógica de negocio la trata — independiente
 * de Prisma, BD, o framework HTTP.
 *
 * Distinción importante:
 *   - El TIPO de Prisma User vive en infrastructure/ (es detalle de implementación).
 *   - Este `User` del domain es lo que viaja entre use-cases y entre slices.
 *
 * Convención: tipos del domain usan camelCase (TypeScript idiomático), aunque
 * la BD use snake_case. Los mappers de infrastructure traducen entre ambos.
 */
import type { UserRole } from "~/shared/types/roles";

export type UserId = number;
export type OrganizationId = bigint;

/** Estado del usuario en el tenant. */
export type UserStatus = "active" | "inactive";

/**
 * Identidad mínima de un usuario autenticado — lo que un loader/action
 * conoce tras `requireSession`. NO incluye PII desencriptada (eso es
 * privilegio explícito vía `getUserProfile`).
 */
export type UserIdentity = {
  userId: UserId;
  username: string;
  role: UserRole;
  organizationId: OrganizationId | null;
  isRoot: boolean;
};

/**
 * Perfil completo de un usuario — incluye PII desencriptada. Solo se obtiene
 * a través del use-case `getUserProfile` que opera bajo tenant context.
 */
export type UserProfile = {
  userId: UserId;
  username: string;
  email: string;
  phoneNumber: string;
  workstation: string;
  employeeNumber: string | null;
  departmentName: string;
  costsCenter: string | null;
  creationDate: Date;
  roleName: UserRole;
};

/**
 * Datos para crear un usuario nuevo. Inputs de boundary (action HTTP);
 * el use-case `createUser` valida + hashea password + encripta PII antes
 * de persistir.
 */
export type CreateUserInput = {
  organizationId: OrganizationId | string;
  roleId: number;
  departmentId: number;
  username: string;
  password: string;
  workstation: string;
  email: string;
  phoneNumber: string;
};

/**
 * Datos para actualizar un usuario. Todos los campos son opcionales — el
 * use-case solo aplica los presentes.
 */
export type UpdateUserInput = Partial<{
  username: string;
  password: string;
  email: string;
  phoneNumber: string;
  workstation: string;
  roleId: number;
  departmentId: number;
  employeeNumber: string | null;
}>;
