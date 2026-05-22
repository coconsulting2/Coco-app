/**
 * @module errors
 * @description Errores tipados del dominio del slice api-keys.
 */
export class ApiKeysError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number = 400) {
    super(message);
    this.name = "ApiKeysError";
  }
}

export class ApiKeyNotFoundError extends ApiKeysError {
  constructor(message?: string) { super(message ?? "ApiKeyNotFoundError", "APIKEYNOTFOUND"); }
}

export class InvalidApiKeyError extends ApiKeysError {
  constructor(message?: string) { super(message ?? "InvalidApiKeyError", "INVALIDAPIKEY"); }
}

export class InsufficientApiKeyScopeError extends ApiKeysError {
  constructor(message?: string) { super(message ?? "InsufficientApiKeyScopeError", "INSUFFICIENTAPIKEYSCOPE"); }
}
