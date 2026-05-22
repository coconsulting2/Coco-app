/**
 * @module PrismaApiKeyRepository
 * @description Adapter Prisma del puerto `ApiKeyRepository`. ÚNICO sitio
 * del slice acoplado a Prisma.
 */
import prisma from "~/platform/db/prisma.server.js";
import type {
  ApiKeyLogRow,
  ApiKeyRow,
  ApiKeyScope,
} from "~/contexts/api-keys/domain/entities/ApiKey.js";
import type {
  ApiKeyRecordWithHash,
  ApiKeyRepository,
  CreateApiKeyData,
  ListLogsOpts,
} from "~/contexts/api-keys/domain/ports/ApiKeyRepository.js";

type PrismaApiKeyRow = {
  id: number;
  organizationId: bigint;
  keyHash: string;
  scope: unknown;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  createdBy: number;
};

type PrismaApiKeyLogRow = {
  id: bigint;
  keyId: number;
  endpoint: string;
  responseCode: number;
  timestamp: Date;
};

function mapRow(row: PrismaApiKeyRow): ApiKeyRecordWithHash {
  return {
    id: row.id,
    orgId: row.organizationId,
    keyHash: row.keyHash,
    scope: (row.scope ?? { permissions: [] }) as ApiKeyScope,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
  };
}

function mapLog(row: PrismaApiKeyLogRow): ApiKeyLogRow {
  return {
    id: row.id,
    keyId: row.keyId,
    endpoint: row.endpoint,
    responseCode: row.responseCode,
    timestamp: row.timestamp,
  };
}

export class PrismaApiKeyRepository implements ApiKeyRepository {
  async findById(id: number): Promise<ApiKeyRecordWithHash | null> {
    const row = await prisma.apiKey.findUnique({ where: { id } });
    return row ? mapRow(row as unknown as PrismaApiKeyRow) : null;
  }

  async findByHash(keyHash: string): Promise<ApiKeyRecordWithHash | null> {
    const row = await prisma.apiKey.findUnique({ where: { keyHash } });
    return row ? mapRow(row as unknown as PrismaApiKeyRow) : null;
  }

  async create(data: CreateApiKeyData): Promise<ApiKeyRecordWithHash> {
    const row = await prisma.apiKey.create({
      data: {
        organizationId: data.orgId,
        keyHash: data.keyHash,
        scope: data.scope as unknown as object,
        expiresAt: data.expiresAt,
        createdBy: data.createdBy,
      },
    });
    return mapRow(row as unknown as PrismaApiKeyRow);
  }

  async revoke(id: number): Promise<ApiKeyRow> {
    const row = await prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
    const mapped = mapRow(row as unknown as PrismaApiKeyRow);
    const { keyHash: _keyHash, ...withoutHash } = mapped;
    void _keyHash;
    return withoutHash;
  }

  async listForOrg(orgId: bigint): Promise<ApiKeyRow[]> {
    const rows = await prisma.apiKey.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        organizationId: true,
        scope: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
        createdBy: true,
      },
    });
    return rows.map((row) => ({
      id: row.id,
      orgId: row.organizationId,
      scope: (row.scope ?? { permissions: [] }) as ApiKeyScope,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      createdAt: row.createdAt,
      createdBy: row.createdBy,
    }));
  }

  async listLogs(keyId: number, opts: ListLogsOpts): Promise<ApiKeyLogRow[]> {
    const { take = 50, cursor } = opts;
    const rows = await prisma.apiKeyLog.findMany({
      where: { keyId },
      orderBy: { timestamp: "desc" },
      take,
      ...(cursor !== undefined && cursor !== null
        ? { skip: 1, cursor: { id: cursor } }
        : {}),
    });
    return rows.map((r) => mapLog(r as unknown as PrismaApiKeyLogRow));
  }

  async createLog(data: {
    keyId: number;
    endpoint: string;
    responseCode: number | null;
  }): Promise<ApiKeyLogRow> {
    const row = await prisma.apiKeyLog.create({
      data: {
        keyId: data.keyId,
        endpoint: data.endpoint,
        responseCode: data.responseCode ?? 0,
      },
    });
    return mapLog(row as unknown as PrismaApiKeyLogRow);
  }
}
