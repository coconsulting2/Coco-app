/**
 * @module @identity (slice public API + composition root)
 * @description Fachada estable del slice identity. Las rutas y otros slices
 * importan SOLO desde aquí.
 *
 * Patrón hexagonal:
 *   - Use-cases en `application/` reciben dependencias por parámetro (DI).
 *   - Adapters concretos en `infrastructure/` implementan los ports del `domain/`.
 *   - Este index expone use-cases pre-wired con los adapters concretos por
 *     default (lo que rutas/loaders consumen), y EXPORTA los raw use-cases
 *     desde `application/*` para que los tests puedan inyectar stubs.
 */

// ── Domain types + errores ────────────────────────────────────────────────
export type {
  UserId,
  UserProfile,
  UserIdentity,
  CreateUserInput,
  UpdateUserInput,
  UserStatus,
  OrganizationId,
} from "~/contexts/identity/domain/entities/User.js";

export {
  IdentityError,
  InvalidCredentialsError,
  UserInactiveError,
  OrganizationSuspendedError,
  EmailAlreadyUsedError,
  UserNotFoundError,
  AmbiguousUsernameError,
} from "~/contexts/identity/domain/errors.js";

export type {
  UserRepository,
  AdminUserView,
} from "~/contexts/identity/domain/ports/UserRepository.js";
export type {
  LookupsRepository,
  RoleLookup,
  DepartmentLookup,
} from "~/contexts/identity/domain/ports/LookupsRepository.js";
export type { PasswordHasher } from "~/contexts/identity/domain/ports/PasswordHasher.js";
export type { SessionTokenSigner } from "~/contexts/identity/domain/ports/SessionTokenSigner.js";
export type { PiiCipher } from "~/contexts/identity/domain/ports/PiiCipher.js";

// ── Composition root (default deps) ───────────────────────────────────────
import { PrismaUserRepository } from "~/contexts/identity/infrastructure/PrismaUserRepository.js";
import { PrismaLookupsRepository } from "~/contexts/identity/infrastructure/PrismaLookupsRepository.js";
import { BcryptPasswordHasher } from "~/contexts/identity/infrastructure/BcryptPasswordHasher.js";
import { JwtSessionTokenSigner } from "~/contexts/identity/infrastructure/JwtSessionTokenSigner.js";
import { PlatformPiiCipher } from "~/contexts/identity/infrastructure/PlatformPiiCipher.js";

import * as authenticateUserModule from "~/contexts/identity/application/authenticateUser.js";
import * as getUserProfileModule from "~/contexts/identity/application/getUserProfile.js";
import * as listLookupsModule from "~/contexts/identity/application/listLookups.js";
import * as manageUsersModule from "~/contexts/identity/application/manageUsers.js";

// Adapters concretos (singletons stateless). Si en algún punto necesitas
// inyectar otros adapters (tests, otra DB), llama los use-cases raw que
// re-exportamos abajo con tus propias instancias.
const defaultUserRepo = new PrismaUserRepository();
const defaultLookupsRepo = new PrismaLookupsRepository();
const defaultHasher = new BcryptPasswordHasher();
const defaultCipher = new PlatformPiiCipher();
// JwtSessionTokenSigner se instancia lazy porque depende de process.env.JWT_SECRET
// (puede no estar disponible al cargar el módulo en bun --filter test).
let cachedSigner: JwtSessionTokenSigner | null = null;
function signer(): JwtSessionTokenSigner {
  if (!cachedSigner) cachedSigner = new JwtSessionTokenSigner();
  return cachedSigner;
}

// ── Use-cases pre-wired (lo que rutas/loaders consumen) ───────────────────

export const authenticateUser = (
  input: authenticateUserModule.AuthenticateUserInput,
) =>
  authenticateUserModule.authenticateUser(input, {
    userRepo: defaultUserRepo,
    hasher: defaultHasher,
    signer: signer(),
  });

export const getUserProfile = (userId: number) =>
  getUserProfileModule.getUserProfile(userId, {
    userRepo: defaultUserRepo,
    cipher: defaultCipher,
  });

export const listAvailableRoles = () =>
  listLookupsModule.listAvailableRoles({ lookupsRepo: defaultLookupsRepo });

export const listAvailableDepartments = () =>
  listLookupsModule.listAvailableDepartments({ lookupsRepo: defaultLookupsRepo });

export const createUser: (
  input: import("~/contexts/identity/domain/entities/User.js").CreateUserInput,
) => Promise<import("~/contexts/identity/domain/entities/User.js").UserProfile> = (input) =>
  manageUsersModule.createUser(input, {
    userRepo: defaultUserRepo,
    lookupsRepo: defaultLookupsRepo,
    hasher: defaultHasher,
    cipher: defaultCipher,
  });

export const updateUserData = (
  userId: number,
  fields: manageUsersModule.UpdateUserAdminInput,
) =>
  manageUsersModule.updateUserData(userId, fields, {
    userRepo: defaultUserRepo,
    lookupsRepo: defaultLookupsRepo,
    hasher: defaultHasher,
    cipher: defaultCipher,
  });

export const deactivateUser = (userId: number) =>
  manageUsersModule.deactivateUser(userId, { userRepo: defaultUserRepo });

export const listUsers = () =>
  manageUsersModule.listUsers({ userRepo: defaultUserRepo });

export const listUsersForAdmin = () =>
  manageUsersModule.listUsersForAdmin({
    userRepo: defaultUserRepo,
    cipher: defaultCipher,
  });

export const findUserInOrg = (
  userId: number,
  organizationId: bigint | number | string,
) =>
  manageUsersModule.findUserInOrg(userId, organizationId, {
    userRepo: defaultUserRepo,
  });

export const getUserWallet = (userId: number) => defaultUserRepo.getWallet(userId);

// ── Raw use-cases (para tests + composiciones custom) ────────────────────
export const usecases = {
  authenticateUser: authenticateUserModule.authenticateUser,
  getUserProfile: getUserProfileModule.getUserProfile,
  listAvailableRoles: listLookupsModule.listAvailableRoles,
  listAvailableDepartments: listLookupsModule.listAvailableDepartments,
  createUser: manageUsersModule.createUser,
  updateUserData: manageUsersModule.updateUserData,
  deactivateUser: manageUsersModule.deactivateUser,
  listUsers: manageUsersModule.listUsers,
  listUsersForAdmin: manageUsersModule.listUsersForAdmin,
  findUserInOrg: manageUsersModule.findUserInOrg,
} as const;

// ── Default adapters export (para tests que quieran reusarlos) ────────────
export const adapters = {
  UserRepository: PrismaUserRepository,
  LookupsRepository: PrismaLookupsRepository,
  PasswordHasher: BcryptPasswordHasher,
  SessionTokenSigner: JwtSessionTokenSigner,
  PiiCipher: PlatformPiiCipher,
} as const;
