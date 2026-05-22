/**
 * @module authenticateUser
 * @description Use-case de autenticación. Recibe dependencias por DI: el
 * `UserRepository` para lookup, el `PasswordHasher` para verificar el password,
 * y el `SessionTokenSigner` para emitir el token de sesión.
 *
 * No conoce HTTP, JWT internals, ni Prisma. Lanza errores de dominio que el
 * caller (api dispatcher o action) traduce a Response HTTP.
 */
import type { PasswordHasher } from "~/contexts/identity/domain/ports/PasswordHasher.js";
import type { SessionTokenSigner } from "~/contexts/identity/domain/ports/SessionTokenSigner.js";
import type {
  UserId,
  OrganizationId,
} from "~/contexts/identity/domain/entities/User.js";
import type { UserRole } from "~/shared/types/roles.js";
import {
  PrismaUserRepository,
  type AuthenticationLookup,
} from "~/contexts/identity/infrastructure/PrismaUserRepository.js";
import {
  InvalidCredentialsError,
  UserInactiveError,
  OrganizationSuspendedError,
  AmbiguousUsernameError,
} from "~/contexts/identity/domain/errors.js";

export type AuthenticateUserInput = {
  username: string;
  password: string;
  ip?: string | null;
  organizationHint?: OrganizationId | number | string | null;
};

export type AuthenticatedSession = {
  token: string;
  userId: UserId;
  username: string;
  role: UserRole;
  organizationId: OrganizationId;
  organizationKind: string;
  departmentId: number | null;
  employeeNumber: string | null;
};

/**
 * Dependencias del use-case. El UserRepository acá es el concreto
 * `PrismaUserRepository` porque autenticación requiere
 * `findAuthenticationLookup` (campos sensibles fuera del port público). En
 * tests, se inyecta una stub que extiende `PrismaUserRepository` o un fake
 * compatible.
 */
export type AuthenticateUserDeps = {
  userRepo: PrismaUserRepository;
  hasher: PasswordHasher;
  signer: SessionTokenSigner;
};

export async function authenticateUser(
  input: AuthenticateUserInput,
  deps: AuthenticateUserDeps,
): Promise<AuthenticatedSession> {
  const username = String(input.username).toLowerCase().trim();
  const orgHint =
    input.organizationHint != null && String(input.organizationHint).trim() !== ""
      ? BigInt(String(input.organizationHint).trim())
      : null;

  const lookup = await deps.userRepo.findAuthenticationLookup(username, orgHint);

  if (lookup === null) {
    throw new InvalidCredentialsError();
  }
  if ("kind" in lookup && lookup.kind === "ambiguous") {
    throw new AmbiguousUsernameError(lookup.organizations);
  }

  const user = lookup as AuthenticationLookup;

  const ok = await deps.hasher.verify(input.password, user.passwordHash);
  if (!ok) {
    throw new InvalidCredentialsError();
  }
  if (!user.active) {
    throw new UserInactiveError();
  }
  if (user.organizationStatus === "SUSPENDED") {
    throw new OrganizationSuspendedError();
  }

  const token = deps.signer.sign({
    userId: user.userId,
    username: user.username,
    role: user.role,
    organizationId: user.organizationId,
    isRoot: user.organizationKind === "ROOT",
    ip: input.ip ?? null,
  });

  return {
    token,
    userId: user.userId,
    username: user.username,
    role: user.role,
    organizationId: user.organizationId,
    organizationKind: user.organizationKind,
    departmentId: user.departmentId,
    employeeNumber: user.employeeNumber,
  };
}
