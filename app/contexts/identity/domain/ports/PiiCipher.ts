/**
 * @module PiiCipher
 * @description Puerto para encriptar/desencriptar PII (email, teléfono).
 * El adapter en platform/crypto usa AES-256-CBC; tests pueden inyectar identidad.
 */
export interface PiiCipher {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
}
