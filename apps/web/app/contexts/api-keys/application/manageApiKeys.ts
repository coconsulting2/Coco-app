/**
 * @module manageApiKeys
 * @description Use-cases puros con DI del slice api-keys.
 */
import type {
  ApiKeyLogRow,
  ApiKeyRecord,
  ApiKeyRow,
  ApiKeyScope,
} from "~/contexts/api-keys/domain/entities/ApiKey.js";
import type { ApiKeyRepository } from "~/contexts/api-keys/domain/ports/ApiKeyRepository.js";
import type { ApiKeyHasher } from "~/contexts/api-keys/infrastructure/ScryptApiKeyHasher.js";
import {
  ApiKeyNotFoundError,
  ApiKeysError,
  InvalidApiKeyError,
} from "~/contexts/api-keys/domain/errors.js";

export type ApiKeysDeps = {
  repo: ApiKeyRepository;
  hasher: ApiKeyHasher;
};

function normalizeScope(scope: unknown): ApiKeyScope {
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) {
    throw new ApiKeysError(
      "scope must be a JSON object",
      "INVALIDSCOPE",
      400,
    );
  }
  const obj = scope as { permissions?: unknown };
  const perms = obj.permissions;
  if (
    !Array.isArray(perms) ||
    perms.length === 0 ||
    !perms.every((p) => typeof p === "string" && p.length > 0)
  ) {
    throw new ApiKeysError(
      "scope.permissions must be a non-empty array of strings",
      "INVALIDSCOPE",
      400,
    );
  }
  return { permissions: perms };
}

function parseExpiresAt(expiresAt: string | Date): Date {
  const d = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(d.getTime())) {
    throw new ApiKeysError("expires_at must be a valid ISO date", "INVALIDEXP", 400);
  }
  if (d.getTime() <= Date.now()) {
    throw new ApiKeysError("expires_at must be in the future", "INVALIDEXP", 400);
  }
  return d;
}

export type IssueApiKeyInput = {
  orgId: bigint | string | number;
  scope: unknown;
  expiresAt: string | Date;
  createdBy: number;
};

export type IssueApiKeyResult = {
  record: ApiKeyRow;
  plainKey: string;
};

export async function issueApiKey(
  input: IssueApiKeyInput,
  deps: ApiKeysDeps,
): Promise<IssueApiKeyResult> {
  const scope = normalizeScope(input.scope);
  const exp = parseExpiresAt(input.expiresAt);
  const orgId = typeof input.orgId === "bigint" ? input.orgId : BigInt(input.orgId);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const plainKey = deps.hasher.generatePlainKey();
    const keyHash = await deps.hasher.hash(plainKey);
    if (keyHash.length !== deps.hasher.expectedHexLength()) {
      throw new ApiKeysError("unexpected hash length", "HASHFAIL", 500);
    }
    try {
      const record = await deps.repo.create({
        orgId,
        keyHash,
        scope,
        expiresAt: exp,
        createdBy: input.createdBy,
      });
      const { keyHash: _persistedHash, ...rest } = record;
      void _persistedHash;
      return { record: rest, plainKey };
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") continue;
      throw err;
    }
  }
  throw new ApiKeysError("could not allocate unique API key hash", "HASHCOLLISION", 500);
}

export async function revokeApiKey(id: number, deps: ApiKeysDeps): Promise<ApiKeyRow> {
  const existing = await deps.repo.findById(id);
  if (!existing) throw new ApiKeyNotFoundError();
  return deps.repo.revoke(id);
}

export async function listApiKeysForOrg(
  orgId: bigint | string | number,
  deps: ApiKeysDeps,
): Promise<ApiKeyRow[]> {
  const oid = typeof orgId === "bigint" ? orgId : BigInt(orgId);
  return deps.repo.listForOrg(oid);
}

export async function listAuditLogs(
  keyId: number,
  query: { limit?: number | string; cursor?: string },
  deps: ApiKeysDeps,
): Promise<ApiKeyLogRow[]> {
  const take = Math.min(Number(query.limit) || 50, 200);
  let cursor: bigint | undefined;
  if (query.cursor !== undefined && query.cursor !== null && String(query.cursor).length > 0) {
    try {
      cursor = BigInt(String(query.cursor));
    } catch {
      throw new ApiKeysError("invalid cursor", "INVALIDCURSOR", 400);
    }
  }
  return deps.repo.listLogs(keyId, { take, cursor });
}

/**
 * Verifica una API key plain contra el repositorio. Lanza
 * `InvalidApiKeyError` si no existe, está revocada o ha vencido.
 */
export async function authenticateApiKey(
  plainKey: string,
  deps: ApiKeysDeps,
): Promise<ApiKeyRecord> {
  if (!plainKey || typeof plainKey !== "string") throw new InvalidApiKeyError();
  const keyHash = await deps.hasher.hash(plainKey);
  const row = await deps.repo.findByHash(keyHash);
  if (!row) throw new InvalidApiKeyError();
  if (row.revokedAt) throw new InvalidApiKeyError("API key revoked");
  if (row.expiresAt.getTime() <= Date.now()) {
    throw new InvalidApiKeyError("API key expired");
  }
  return row;
}

export function scopeHasAllPermissions(
  scope: ApiKeyScope | { permissions?: unknown } | null | undefined,
  ...permissionCodes: string[]
): boolean {
  const perms =
    scope && typeof scope === "object" && Array.isArray((scope as ApiKeyScope).permissions)
      ? (scope as ApiKeyScope).permissions
      : [];
  const set = new Set(perms);
  return permissionCodes.every((c) => set.has(c));
}

export function scopeHasAnyPermission(
  scope: ApiKeyScope | { permissions?: unknown } | null | undefined,
  ...permissionCodes: string[]
): boolean {
  const perms =
    scope && typeof scope === "object" && Array.isArray((scope as ApiKeyScope).permissions)
      ? (scope as ApiKeyScope).permissions
      : [];
  const set = new Set(perms);
  return permissionCodes.some((c) => set.has(c));
}

/** Logs una entrada de auditoría tras servir el request. */
export async function logApiKeyUsage(
  apiKey: ApiKeyRecord,
  endpoint: string,
  responseCode: number | null,
  deps: ApiKeysDeps,
): Promise<void> {
  try {
    await deps.repo.createLog({ keyId: apiKey.id, endpoint, responseCode });
  } catch (err) {
    console.warn("[logApiKeyUsage]", (err as Error).message);
  }
}
