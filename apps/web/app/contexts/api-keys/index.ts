/**
 * @module api-keys (slice public API + composition root)
 * @description Hexagonal proper: port `ApiKeyRepository`, adapter Prisma,
 * hasher scrypt+pepper, use-cases con DI.
 */

// ── Domain types + errores ────────────────────────────────────────────────
export type {
  ApiKey,
  ApiKeyRow,
  ApiKeyRecord,
  ApiKeyScope,
  ApiKeyLogRow,
} from "~/contexts/api-keys/domain/entities/ApiKey.js";

export type {
  ApiKeyRepository,
  ApiKeyRecordWithHash,
  CreateApiKeyData,
  ListLogsOpts,
} from "~/contexts/api-keys/domain/ports/ApiKeyRepository.js";

export type { ApiKeyHasher } from "~/contexts/api-keys/infrastructure/ScryptApiKeyHasher.js";

export {
  ApiKeysError,
  ApiKeyNotFoundError,
  InvalidApiKeyError,
  InsufficientApiKeyScopeError,
} from "~/contexts/api-keys/domain/errors.js";

// ── Composition root ──────────────────────────────────────────────────────
import { PrismaApiKeyRepository } from "~/contexts/api-keys/infrastructure/PrismaApiKeyRepository.js";
import { ScryptApiKeyHasher } from "~/contexts/api-keys/infrastructure/ScryptApiKeyHasher.js";
import * as manageModule from "~/contexts/api-keys/application/manageApiKeys.js";

const defaultRepo = new PrismaApiKeyRepository();
const defaultHasher = new ScryptApiKeyHasher();
const defaultDeps: manageModule.ApiKeysDeps = {
  repo: defaultRepo,
  hasher: defaultHasher,
};

export const issueApiKey = (input: manageModule.IssueApiKeyInput) =>
  manageModule.issueApiKey(input, defaultDeps);

export const revokeApiKey = (id: number) => manageModule.revokeApiKey(id, defaultDeps);

export const listApiKeysForOrg = (orgId: bigint | string | number) =>
  manageModule.listApiKeysForOrg(orgId, defaultDeps);

export const listAuditLogs = (
  keyId: number,
  query: { limit?: number | string; cursor?: string } = {},
) => manageModule.listAuditLogs(keyId, query, defaultDeps);

export const authenticateApiKey = (plainKey: string) =>
  manageModule.authenticateApiKey(plainKey, defaultDeps);

export const logApiKeyUsage = (
  apiKey: import("~/contexts/api-keys/domain/entities/ApiKey.js").ApiKeyRecord,
  endpoint: string,
  responseCode: number | null,
) => manageModule.logApiKeyUsage(apiKey, endpoint, responseCode, defaultDeps);

export const scopeHasAllPermissions = manageModule.scopeHasAllPermissions;
export const scopeHasAnyPermission = manageModule.scopeHasAnyPermission;

/** Hash directo (utilidad para platform/api-key-auth). */
export const hashApiKey = (plainKey: string) => defaultHasher.hash(plainKey);

// ── Raw use-cases ─────────────────────────────────────────────────────────
export const usecases = {
  issueApiKey: manageModule.issueApiKey,
  revokeApiKey: manageModule.revokeApiKey,
  listApiKeysForOrg: manageModule.listApiKeysForOrg,
  listAuditLogs: manageModule.listAuditLogs,
  authenticateApiKey: manageModule.authenticateApiKey,
  scopeHasAllPermissions: manageModule.scopeHasAllPermissions,
  scopeHasAnyPermission: manageModule.scopeHasAnyPermission,
  logApiKeyUsage: manageModule.logApiKeyUsage,
} as const;

export const adapters = {
  ApiKeyRepository: PrismaApiKeyRepository,
  ApiKeyHasher: ScryptApiKeyHasher,
} as const;
