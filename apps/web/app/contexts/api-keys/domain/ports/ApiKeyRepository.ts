/**
 * @module ApiKeyRepository
 * @description Puerto del slice api-keys: queries y mutaciones sobre las
 * tablas `api_keys` y `api_key_logs`. El adapter Prisma vive en
 * `infrastructure/PrismaApiKeyRepository.ts`.
 */
import type {
  ApiKeyLogRow,
  ApiKeyRow,
  ApiKeyScope,
} from "~/contexts/api-keys/domain/entities/ApiKey.js";

export type CreateApiKeyData = {
  orgId: bigint;
  keyHash: string;
  scope: ApiKeyScope;
  expiresAt: Date;
  createdBy: number;
};

export type ApiKeyRecordWithHash = ApiKeyRow & { keyHash: string };

export type ListLogsOpts = { take?: number; cursor?: bigint };

export interface ApiKeyRepository {
  findById(id: number): Promise<ApiKeyRecordWithHash | null>;
  findByHash(keyHash: string): Promise<ApiKeyRecordWithHash | null>;
  create(data: CreateApiKeyData): Promise<ApiKeyRecordWithHash>;
  revoke(id: number): Promise<ApiKeyRow>;
  listForOrg(orgId: bigint): Promise<ApiKeyRow[]>;
  listLogs(keyId: number, opts: ListLogsOpts): Promise<ApiKeyLogRow[]>;
  createLog(data: {
    keyId: number;
    endpoint: string;
    responseCode: number | null;
  }): Promise<ApiKeyLogRow>;
}
