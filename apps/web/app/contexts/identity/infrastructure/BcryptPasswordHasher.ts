/**
 * @module BcryptPasswordHasher
 * @description Adapter bcrypt del port `PasswordHasher`. Único sitio del slice
 * con dependencia directa a `bcrypt`. Tests pueden inyectar una stub
 * implementando el mismo port.
 */
import bcrypt from "bcrypt";
import type { PasswordHasher } from "~/contexts/identity/domain/ports/PasswordHasher.js";

const DEFAULT_ROUNDS = 12;

export class BcryptPasswordHasher implements PasswordHasher {
  constructor(private readonly rounds: number = DEFAULT_ROUNDS) {}

  hash(plaintext: string): Promise<string> {
    return bcrypt.hash(plaintext, this.rounds);
  }

  verify(plaintext: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plaintext, hashed);
  }
}
