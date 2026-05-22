/**
 * @module manageUsers
 * @description Use-cases administrativos del slice identity (CRUD de usuarios).
 * Todos reciben dependencias por DI vía `UserRepository`, `PasswordHasher`,
 * `PiiCipher`. No conocen Prisma ni bcrypt directamente.
 *
 * Cubre lo que el legacy hacía en adminService.js + adminAccountsService.js.
 */
import type {
  UserRepository,
  AdminUserView,
} from "~/contexts/identity/domain/ports/UserRepository.js";
import type { LookupsRepository } from "~/contexts/identity/domain/ports/LookupsRepository.js";
import type { PasswordHasher } from "~/contexts/identity/domain/ports/PasswordHasher.js";
import type { PiiCipher } from "~/contexts/identity/domain/ports/PiiCipher.js";
import type {
  CreateUserInput,
  UpdateUserInput,
  UserId,
  UserProfile,
  OrganizationId,
} from "~/contexts/identity/domain/entities/User.js";
import { PrismaUserRepository } from "~/contexts/identity/infrastructure/PrismaUserRepository.js";
import { EmailAlreadyUsedError } from "~/contexts/identity/domain/errors.js";

export type ManageUsersDeps = {
  userRepo: UserRepository;
  lookupsRepo: LookupsRepository;
  hasher: PasswordHasher;
  cipher: PiiCipher;
};

/**
 * Verifica si un email plaintext ya está usado por algún usuario. Los emails
 * se almacenan encriptados con IV aleatorio, así que no se puede aprovechar
 * un índice único de Postgres; debemos desencriptar cada uno y comparar.
 * Costo O(n) — aceptable para org sizes habituales pero documentar como deuda.
 */
async function isEmailInUse(
  plaintextEmail: string,
  exceptUserId: UserId | null,
  deps: Pick<ManageUsersDeps, "userRepo" | "cipher">,
): Promise<boolean> {
  const encryptedEmails = await deps.userRepo.listEncryptedEmails();
  for (const enc of encryptedEmails) {
    const decoded = deps.cipher.decrypt(enc);
    if (decoded === plaintextEmail) {
      if (exceptUserId !== null) {
        // Si el caller pasó un userId actual, validamos que el email coincida
        // exactamente con el suyo (no es duplicado, es el mismo usuario).
        // El repo no expone userId por email, así que comparamos por equivalencia
        // del encrypted string contra el del usuario.
        const current = await deps.userRepo.findById(exceptUserId);
        if (current?.email === enc) continue;
      }
      return true;
    }
  }
  return false;
}

/** Crea un usuario nuevo. Hashea password, encripta PII, verifica unicidad de email. */
export async function createUser(
  input: CreateUserInput,
  deps: ManageUsersDeps,
): Promise<UserProfile> {
  if (await isEmailInUse(input.email, null, deps)) {
    throw new EmailAlreadyUsedError();
  }
  const passwordHash = await deps.hasher.hash(input.password);
  const encryptedEmail = deps.cipher.encrypt(input.email);
  const encryptedPhone = deps.cipher.encrypt(input.phoneNumber);

  return deps.userRepo.create({
    ...input,
    password: passwordHash,
    email: encryptedEmail,
    phoneNumber: encryptedPhone,
  });
}

/**
 * Input alto-nivel que el formulario admin manda (con role_name / department_name).
 * El use-case resuelve a roleId/departmentId via LookupsRepository.
 */
export type UpdateUserAdminInput = Partial<{
  user_name: string;
  password: string;
  workstation: string;
  email: string;
  phone_number: string;
  role_id: number;
  department_id: number;
  /** Alternativa a role_id — resuelto vía LookupsRepository (legacy CSV import). */
  role_name: string;
  /** Alternativa a department_id — resuelto vía LookupsRepository. */
  department_name: string;
  no_empleado: string | null;
}>;

export type UpdateUserResult =
  | { changed: false; message: string }
  | { changed: true; message: string; updatedFields: string[] };

/**
 * Actualiza datos parciales del usuario. Compara contra el valor actual,
 * resuelve role_name/department_name a IDs vía LookupsRepository, encripta
 * email/phone, verifica unicidad de email. Solo escribe campos que realmente
 * cambiaron (mismo patrón que el legacy).
 */
export async function updateUserData(
  userId: UserId,
  newData: UpdateUserAdminInput,
  deps: ManageUsersDeps,
): Promise<UpdateUserResult> {
  const current = await deps.userRepo.findById(userId);
  if (!current) {
    throw new Error(`User ${userId} not found`);
  }
  const currentEmail = deps.cipher.decrypt(current.email);

  const patch: UpdateUserInput = {};
  const updatedFields: string[] = [];

  if (newData.user_name !== undefined && newData.user_name !== current.username) {
    patch.username = newData.user_name;
    updatedFields.push("user_name");
  }
  if (newData.workstation !== undefined && newData.workstation !== current.workstation) {
    patch.workstation = newData.workstation;
    updatedFields.push("workstation");
  }
  if (newData.password !== undefined) {
    patch.password = await deps.hasher.hash(newData.password);
    updatedFields.push("password");
  }
  if (newData.email !== undefined && newData.email !== currentEmail) {
    if (await isEmailInUse(newData.email, userId, deps)) {
      throw new EmailAlreadyUsedError();
    }
    patch.email = deps.cipher.encrypt(newData.email);
    updatedFields.push("email");
  }
  if (newData.phone_number !== undefined) {
    patch.phoneNumber = deps.cipher.encrypt(newData.phone_number);
    updatedFields.push("phone_number");
  }
  if (newData.no_empleado !== undefined) {
    patch.employeeNumber = newData.no_empleado;
    updatedFields.push("no_empleado");
  }
  if (newData.role_id !== undefined && Number.isFinite(newData.role_id)) {
    patch.roleId = Number(newData.role_id);
    updatedFields.push("role_id");
  } else if (newData.role_name !== undefined) {
    const roleId = await deps.lookupsRepo.findRoleIdByName(newData.role_name);
    if (roleId === null) {
      throw new Error(`Invalid role name: ${newData.role_name}`);
    }
    patch.roleId = roleId;
    updatedFields.push("role_name");
  }
  if (newData.department_id !== undefined && Number.isFinite(newData.department_id)) {
    patch.departmentId = Number(newData.department_id);
    updatedFields.push("department_id");
  } else if (newData.department_name !== undefined) {
    const deptId = await deps.lookupsRepo.findDepartmentIdByName(newData.department_name);
    if (deptId === null) {
      throw new Error(`Invalid department name: ${newData.department_name}`);
    }
    patch.departmentId = deptId;
    updatedFields.push("department_name");
  }

  if (updatedFields.length === 0) {
    return { changed: false, message: "No changes detected, user data is up to date" };
  }
  await deps.userRepo.update(userId, patch);
  return {
    changed: true,
    message: "User updated successfully",
    updatedFields,
  };
}

/** Lista admin: incluye PII desencriptada. RLS-scoped por tenant. */
export async function listUsersForAdmin(
  deps: Pick<ManageUsersDeps, "userRepo" | "cipher">,
): Promise<Array<AdminUserView & { phoneNumberDecrypted: string; emailDecrypted: string }>> {
  const rows = await deps.userRepo.listForAdmin();
  return rows.map((u) => ({
    ...u,
    emailDecrypted: deps.cipher.decrypt(u.email),
    phoneNumberDecrypted: u.phoneNumber ? deps.cipher.decrypt(u.phoneNumber) : "",
  }));
}

/** Soft delete. */
export async function deactivateUser(
  userId: UserId,
  deps: Pick<ManageUsersDeps, "userRepo">,
): Promise<void> {
  await deps.userRepo.deactivate(userId);
}

/** Lista todos los usuarios visibles (activos) en el tenant scope. */
export async function listUsers(
  deps: Pick<ManageUsersDeps, "userRepo">,
): Promise<UserProfile[]> {
  return deps.userRepo.list();
}

/**
 * Lookup cross-tenant — usado por super-admin para validar pertenencia de
 * usuario en una org específica. Requiere `PrismaUserRepository` (no el port
 * genérico) por la operación cross-tenant.
 */
export async function findUserInOrg(
  userId: UserId,
  organizationId: OrganizationId | number | string,
  deps: { userRepo: PrismaUserRepository },
): Promise<{ userId: UserId; organizationId: OrganizationId; employeeNumber: string | null } | null> {
  return deps.userRepo.findInOrganization(userId, BigInt(organizationId));
}
