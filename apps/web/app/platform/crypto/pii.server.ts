/**
 * @module pii.server
 * @description PII encryption/decryption helpers. Formato:
 *   IV 16 bytes en hex (32 chars) + ciphertext base64.
 *
 * Usuarios creados por seed/Prisma/import guardan email/teléfono en claro;
 * `decrypt` detecta el prefijo IV-hex y solo desencripta cuando aplica.
 */
import crypto from "node:crypto";

function getKey(): Buffer {
  const key = process.env.AES_SECRET_KEY;
  if (!key) {
    throw new Error("AES_SECRET_KEY no configurado");
  }
  return Buffer.from(key);
}

function looksLikeEncryptedIvPlusBase64(str: string): boolean {
  if (typeof str !== "string" || str.length <= 32) return false;
  return /^[0-9a-f]{32}$/i.test(str.slice(0, 32));
}

export function encrypt(plaintext: string): string {
  const IV = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", getKey(), IV);
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  return IV.toString("hex") + encrypted;
}

export function decrypt(encryptedData: string): string {
  try {
    if (!encryptedData || typeof encryptedData !== "string") {
      return encryptedData;
    }
    if (!looksLikeEncryptedIvPlusBase64(encryptedData)) {
      return encryptedData;
    }
    const IV = Buffer.from(encryptedData.slice(0, 32), "hex");
    const cipherText = encryptedData.slice(32);
    const decipher = crypto.createDecipheriv("aes-256-cbc", getKey(), IV);
    let decrypted = decipher.update(cipherText, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Decryption error:", error);
    return encryptedData;
  }
}
