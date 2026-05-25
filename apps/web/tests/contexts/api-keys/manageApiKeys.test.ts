/**
 * Unit tests de los use-cases `issueApiKey` y `authenticateApiKey` del slice
 * api-keys, con stubs in-memory del `ApiKeyRepository` y un `ApiKeyHasher`
 * determinista. Cubre: emisión feliz (no expone keyHash), validación de scope
 * y expiración, reintento ante colisión P2002, y autenticación
 * (válida / inexistente / revocada / vencida).
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("~/platform/logger/log/logger.js", () => ({
  Logger: () => ({ info() {}, warn() {}, error() {}, trace() {}, debug() {} }),
}));

import {
  issueApiKey,
  authenticateApiKey,
} from "~/contexts/api-keys/application/manageApiKeys.js";
import type { ApiKeysDeps } from "~/contexts/api-keys/application/manageApiKeys.js";
import type {
  ApiKeyRepository,
  ApiKeyRecordWithHash,
  CreateApiKeyData,
} from "~/contexts/api-keys/domain/ports/ApiKeyRepository.js";
import type { ApiKeyHasher } from "~/contexts/api-keys/infrastructure/ScryptApiKeyHasher.js";
import { ApiKeysError, InvalidApiKeyError } from "~/contexts/api-keys/domain/errors.js";

const FUTURE = new Date(Date.now() + 86_400_000);
const PAST = new Date(Date.now() - 1000);

function makeHasher(): ApiKeyHasher {
  return {
    hash: vi.fn(async (plain: string) => `hash:${plain}`),
    generatePlainKey: vi.fn(() => "plainkey-123"),
    expectedHexLength: vi.fn(() => "hash:plainkey-123".length),
  };
}

function makeRepo(over: Partial<ApiKeyRepository> = {}): ApiKeyRepository {
  return {
    findById: vi.fn(async () => null),
    findByHash: vi.fn(async () => null),
    create: vi.fn(async (data: CreateApiKeyData) => ({
      id: 1,
      orgId: data.orgId,
      scope: data.scope,
      expiresAt: data.expiresAt,
      revokedAt: null,
      createdAt: new Date(),
      createdBy: data.createdBy,
      keyHash: data.keyHash,
    })),
    revoke: vi.fn(),
    listForOrg: vi.fn(async () => []),
    listLogs: vi.fn(async () => []),
    createLog: vi.fn(async () => ({
      id: 1n,
      keyId: 1,
      endpoint: "/x",
      responseCode: 200,
      timestamp: new Date(),
    })),
    ...over,
  };
}

function row(over: Partial<ApiKeyRecordWithHash> = {}): ApiKeyRecordWithHash {
  return {
    id: 1,
    orgId: 101n,
    scope: { permissions: ["api:read"] },
    expiresAt: FUTURE,
    revokedAt: null,
    createdAt: new Date(),
    createdBy: 5,
    keyHash: "hash:plainkey-123",
    ...over,
  };
}

describe("issueApiKey", () => {
  it("emite una key, devuelve el plainKey y NO expone el keyHash", async () => {
    const repo = makeRepo();
    const deps: ApiKeysDeps = { repo, hasher: makeHasher() };

    const result = await issueApiKey(
      { orgId: 101, scope: { permissions: ["api:read"] }, expiresAt: FUTURE, createdBy: 5 },
      deps,
    );

    expect(result.plainKey).toBe("plainkey-123");
    expect(result.record).not.toHaveProperty("keyHash");
    expect(result.record.orgId).toBe(101n);
    expect(repo.create).toHaveBeenCalledTimes(1);
  });

  it("rechaza un scope sin permissions válido", async () => {
    const deps: ApiKeysDeps = { repo: makeRepo(), hasher: makeHasher() };
    await expect(
      issueApiKey({ orgId: 101, scope: { permissions: [] }, expiresAt: FUTURE, createdBy: 5 }, deps),
    ).rejects.toBeInstanceOf(ApiKeysError);
  });

  it("rechaza una expiración en el pasado", async () => {
    const deps: ApiKeysDeps = { repo: makeRepo(), hasher: makeHasher() };
    await expect(
      issueApiKey({ orgId: 101, scope: { permissions: ["x"] }, expiresAt: PAST, createdBy: 5 }, deps),
    ).rejects.toBeInstanceOf(ApiKeysError);
  });

  it("reintenta al colisionar el hash (P2002) y termina exitoso", async () => {
    let calls = 0;
    const repo = makeRepo({
      create: vi.fn(async (data: CreateApiKeyData) => {
        calls += 1;
        if (calls === 1) throw Object.assign(new Error("dup"), { code: "P2002" });
        return {
          id: 2,
          orgId: data.orgId,
          scope: data.scope,
          expiresAt: data.expiresAt,
          revokedAt: null,
          createdAt: new Date(),
          createdBy: data.createdBy,
          keyHash: data.keyHash,
        };
      }),
    });
    const deps: ApiKeysDeps = { repo, hasher: makeHasher() };

    const result = await issueApiKey(
      { orgId: 101, scope: { permissions: ["api:read"] }, expiresAt: FUTURE, createdBy: 5 },
      deps,
    );

    expect(calls).toBe(2);
    expect(result.record.id).toBe(2);
  });
});

describe("authenticateApiKey", () => {
  it("devuelve el record para una key válida", async () => {
    const repo = makeRepo({ findByHash: vi.fn(async () => row()) });
    const result = await authenticateApiKey("plainkey-123", { repo, hasher: makeHasher() });
    expect(result.id).toBe(1);
    expect(repo.findByHash).toHaveBeenCalledWith("hash:plainkey-123");
  });

  it("lanza InvalidApiKeyError cuando la key no existe", async () => {
    const repo = makeRepo({ findByHash: vi.fn(async () => null) });
    await expect(
      authenticateApiKey("plainkey-123", { repo, hasher: makeHasher() }),
    ).rejects.toBeInstanceOf(InvalidApiKeyError);
  });

  it("lanza InvalidApiKeyError cuando la key está revocada", async () => {
    const repo = makeRepo({ findByHash: vi.fn(async () => row({ revokedAt: new Date() })) });
    await expect(
      authenticateApiKey("plainkey-123", { repo, hasher: makeHasher() }),
    ).rejects.toBeInstanceOf(InvalidApiKeyError);
  });

  it("lanza InvalidApiKeyError cuando la key está vencida", async () => {
    const repo = makeRepo({ findByHash: vi.fn(async () => row({ expiresAt: PAST })) });
    await expect(
      authenticateApiKey("plainkey-123", { repo, hasher: makeHasher() }),
    ).rejects.toBeInstanceOf(InvalidApiKeyError);
  });

  it("lanza InvalidApiKeyError cuando el plainKey es vacío", async () => {
    await expect(
      authenticateApiKey("", { repo: makeRepo(), hasher: makeHasher() }),
    ).rejects.toBeInstanceOf(InvalidApiKeyError);
  });
});
