/**
 * @module ApiKey
 * @description Entidades de dominio del slice api-keys.
 */

export type ApiKeyScope = {
  /** Permission codes que la API key puede usar. */
  permissions: string[];
};

export type ApiKeyRow = {
  id: number;
  orgId: bigint;
  scope: ApiKeyScope;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  createdBy: number;
};

export type ApiKeyRecord = ApiKeyRow & {
  keyHash: string;
};

export type ApiKeyLogRow = {
  id: bigint;
  keyId: number;
  endpoint: string;
  responseCode: number | null;
  timestamp: Date;
};

/** Re-export legacy shape para no romper código consumidor. */
export type ApiKey = ApiKeyRow;
