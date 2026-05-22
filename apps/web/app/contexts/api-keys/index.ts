/**
 * @module index
 * @description API pública del slice api-keys.
 */

export type { ApiKey } from "~/contexts/api-keys/domain/entities/ApiKey";
export type { ApiKeyRepository } from "~/contexts/api-keys/domain/ports/ApiKeyRepository";
export { ApiKeysError, ApiKeyNotFoundError, InvalidApiKeyError, InsufficientApiKeyScopeError } from "~/contexts/api-keys/domain/errors";

// @ts-ignore — JS module
export { listApiKeys, createApiKey, rotateApiKey, revokeApiKey, validateApiKey } from "~/contexts/api-keys/application/apiKeyService.js";
