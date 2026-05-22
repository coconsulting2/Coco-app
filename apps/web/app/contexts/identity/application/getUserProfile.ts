/**
 * @module getUserProfile
 * @description Use-case para retrieval de perfil completo de usuario con PII
 * desencriptada. Requiere tenant context activo (RLS) — el caller lo garantiza
 * vía `runInTenant`.
 *
 * Dependencias: `UserRepository` para fetch y `PiiCipher` para desencriptar.
 * No conoce Prisma ni AES_SECRET_KEY directos.
 */
import type { UserRepository } from "~/contexts/identity/domain/ports/UserRepository.js";
import type { PiiCipher } from "~/contexts/identity/domain/ports/PiiCipher.js";
import type { UserId, UserProfile } from "~/contexts/identity/domain/entities/User.js";
import { UserNotFoundError } from "~/contexts/identity/domain/errors.js";

export type GetUserProfileDeps = {
  userRepo: UserRepository;
  cipher: PiiCipher;
};

export async function getUserProfile(
  userId: UserId,
  deps: GetUserProfileDeps,
): Promise<UserProfile> {
  const row = await deps.userRepo.findById(userId);
  if (!row) {
    throw new UserNotFoundError(userId);
  }
  return {
    ...row,
    email: deps.cipher.decrypt(row.email),
    phoneNumber: deps.cipher.decrypt(row.phoneNumber),
  };
}
