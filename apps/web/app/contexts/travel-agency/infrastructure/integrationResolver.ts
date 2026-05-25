/**
 * @module integrationResolver
 * @description Resuelve la configuración efectiva de una integración (SMTP, Wise, SAT,
 * Banxico, VAPID) para una org. Si la org tiene override en `organization_integrations`,
 * lo devuelve; si no, fallback a env vars (default Ditta-managed).
 *
 * El config en BD viaja encriptado con AES_SECRET_KEY usando el mismo helper que
 * el resto de PII. Aquí solo se descifra al leer.
 *
 * Caché: LRU in-memory con TTL 60s para evitar query por request. Invalidar
 * llamando `invalidateIntegrationCache(organizationId, provider)` después de update.
 */
import { withRls } from "~/platform/db/rls.server.js";
import { decrypt } from "~/platform/crypto/pii.server.js";
import { Logger } from "~/platform/logger/log/logger.js";

const log = Logger("integration-resolver");

export type IntegrationProvider = "SMTP" | "WISE" | "SAT" | "BANXICO" | "VAPID";

export type IntegrationConfig = Record<string, string | number | null>;

type CacheEntry = { value: IntegrationConfig; expiresAt: number };

const TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

export async function resolveIntegration(
  organizationId: bigint | number | string,
  provider: IntegrationProvider,
): Promise<IntegrationConfig> {
  const key = `${String(organizationId)}:${provider}`;
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;

  const orgIdBig = BigInt(organizationId);
  // Bypass para leer la fila aunque el RLS context no esté seteado correctamente
  // (este resolver corre desde jobs internos, schedulers, etc.).
  const row = await withRls(orgIdBig, { bypass: true }, (tx) =>
    tx.organizationIntegration.findUnique({
      where: { organizationId_provider: { organizationId: orgIdBig, provider } },
    }),
  );

  let value: IntegrationConfig;
  if (row && row.active) {
    try {
      const decryptedJson = decrypt(row.config);
      value = JSON.parse(decryptedJson) as IntegrationConfig;
    } catch (err) {
      log.error(
        `integrationResolver: failed to decrypt ${provider} for org ${String(organizationId)}: ${(err as Error).message}`,
      );
      value = getFallbackConfig(provider);
    }
  } else {
    value = getFallbackConfig(provider);
  }

  cache.set(key, { value, expiresAt: now + TTL_MS });
  return value;
}

export function invalidateIntegrationCache(
  organizationId: bigint | number | string,
  provider: IntegrationProvider,
): void {
  cache.delete(`${String(organizationId)}:${provider}`);
}

/** Fallback global desde env vars. Documento de referencia: .env.example. */
function getFallbackConfig(provider: IntegrationProvider): IntegrationConfig {
  switch (provider) {
    case "SMTP":
      return {
        user: process.env.MAIL_USER ?? null,
        password: process.env.MAIL_PASSWORD ?? null,
      };
    case "WISE":
      return {
        clientId: process.env.WISE_CLIENT_ID ?? null,
        clientSecret: process.env.WISE_CLIENT_SECRET ?? null,
      };
    case "SAT":
      return {
        wsdlUrl: process.env.SAT_WSDL_URL ?? null,
        timeoutMs: Number(process.env.SAT_REQUEST_TIMEOUT_MS) || 30000,
      };
    case "BANXICO":
      return {
        apiKey: process.env.BANXICO_API_KEY ?? null,
        apiUrl: process.env.BMX_API_URL ?? null,
      };
    case "VAPID":
      return {
        publicKey: process.env.VAPID_PUBLIC_KEY ?? null,
        privateKey: process.env.VAPID_PRIVATE_KEY ?? null,
        mailto: process.env.VAPID_MAILTO ?? null,
      };
    default:
      return {};
  }
}
