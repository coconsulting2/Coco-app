/**
 * @module PlatformPiiCipher
 * @description Adapter del port `PiiCipher` que delega en `platform/crypto/pii.server`.
 * El platform module hace AES-256-CBC con `AES_SECRET_KEY`; este adapter solo
 * adapta la interfaz para satisfacer el contrato del slice.
 *
 * Tests pueden inyectar una stub (identity cipher) si quieren bypass del crypto.
 */
import { decrypt as platformDecrypt, encrypt as platformEncrypt } from "~/platform/crypto/pii.server.js";
import type { PiiCipher } from "~/contexts/identity/domain/ports/PiiCipher.js";

export class PlatformPiiCipher implements PiiCipher {
  encrypt(plaintext: string): string {
    return platformEncrypt(plaintext);
  }
  decrypt(ciphertext: string): string {
    return platformDecrypt(ciphertext);
  }
}
