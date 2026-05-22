/**
 * @module ScryptApiKeyHasher
 * @description Hash determinista (scrypt + pepper) para resolver API keys
 * por índice único en `api_keys.key_hash`. Pepper viene de
 * `API_KEY_HASH_PEPPER` (fallback `JWT_SECRET`). Mismas constantes que el
 * legacy `apiKeyService.js` para preservar compatibilidad con hashes
 * persistidos.
 */
import { scrypt as _scrypt, randomBytes } from "node:crypto";

const KEY_PREFIX = "cck_";
const HASH_HEX_LEN = 64;
const SCRYPT_KEYLEN = 32;
const SCRYPT_OPTIONS = Object.freeze({
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
});

function getPepper(): string {
  const pepper = process.env.API_KEY_HASH_PEPPER ?? process.env.JWT_SECRET;
  if (!pepper || typeof pepper !== "string" || pepper.length < 16) {
    throw new Error(
      "API_KEY_HASH_PEPPER (or JWT_SECRET fallback) must be >=16 chars to hash API keys",
    );
  }
  return pepper;
}

export interface ApiKeyHasher {
  hash(plainKey: string): Promise<string>;
  generatePlainKey(): string;
  expectedHexLength(): number;
}

export class ScryptApiKeyHasher implements ApiKeyHasher {
  async hash(plainKey: string): Promise<string> {
    // `promisify(_scrypt)` aplaza a la firma simple (sin options). Para
    // pasar SCRYPT_OPTIONS usamos el callback directo de node:crypto.
    const buf = await new Promise<Buffer>((resolve, reject) => {
      _scrypt(plainKey, getPepper(), SCRYPT_KEYLEN, SCRYPT_OPTIONS, (err, derived) => {
        if (err) reject(err);
        else resolve(derived);
      });
    });
    return buf.toString("hex");
  }

  generatePlainKey(): string {
    return `${KEY_PREFIX}${randomBytes(32).toString("hex")}`;
  }

  expectedHexLength(): number {
    return HASH_HEX_LEN;
  }
}
