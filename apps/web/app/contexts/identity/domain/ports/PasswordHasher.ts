/**
 * @module PasswordHasher
 * @description Puerto para hash de passwords. El adapter concreto en
 * infrastructure/ usa bcrypt; tests pueden inyectar una stub.
 */
export interface PasswordHasher {
  hash(plaintext: string): Promise<string>;
  verify(plaintext: string, hashed: string): Promise<boolean>;
}
