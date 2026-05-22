/**
 * @module index
 * @description API pública del slice identity. Otros slices y la capa de
 * routes/interface importan SOLO desde aquí — no profundizan en
 * `application/` o `infrastructure/`. Esto enforza la encapsulación del slice.
 *
 * Exporta:
 *   - Tipos del domain (User, UserProfile, UserIdentity, errores)
 *   - Use-cases públicos (los que las routes pueden invocar)
 *
 * No exporta:
 *   - Modelos Prisma (privados al slice)
 *   - Puertos (privados al slice, salvo para tests)
 */

// ── Domain types ──────────────────────────────────────────────────────────
export type {
  UserId,
  UserProfile,
  UserIdentity,
  CreateUserInput,
  UpdateUserInput,
  UserStatus,
  OrganizationId,
} from "~/contexts/identity/domain/entities/User";

export {
  IdentityError,
  InvalidCredentialsError,
  UserInactiveError,
  OrganizationSuspendedError,
  EmailAlreadyUsedError,
  UserNotFoundError,
  AmbiguousUsernameError,
} from "~/contexts/identity/domain/errors";

// ── Use-cases públicos ────────────────────────────────────────────────────
// Notas: estos re-exportan el service JS copiado del legacy. Cuando se haga
// el refactor a TypeScript con puertos inyectados, este index se vuelve la
// fachada estable: cambios internos del slice no rompen a sus consumidores.
// @ts-ignore — JS module
export { getUserById } from "~/contexts/identity/application/userService.js";
// @ts-ignore
export { authenticateUser } from "~/contexts/identity/application/userService.js";
// @ts-ignore
export { createUser, updateUserData } from "~/contexts/identity/application/adminService.js";
// @ts-ignore
export { deactivateUser, findUserInOrg } from "~/contexts/identity/application/adminAccountsService.js";
// @ts-ignore
export {
  listAvailableRoles,
  listAvailableDepartments,
} from "~/contexts/identity/application/lookupsService.js";
