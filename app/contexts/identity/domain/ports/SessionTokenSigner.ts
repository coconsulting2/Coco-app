/**
 * @module SessionTokenSigner
 * @description Puerto para firma/verificación de tokens de sesión (JWT).
 * El adapter concreto vive en platform/session/jwt.server.ts.
 */
import type { UserIdentity } from "~/contexts/identity/domain/entities/User";

export interface SessionTokenSigner {
  sign(payload: UserIdentity & { ip?: string | null }): string;
  verify(token: string): Promise<UserIdentity>;
}
