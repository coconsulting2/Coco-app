/**
 * Unit tests de los use-cases hex del slice organizations con stubs in-memory
 * de los puertos `OrganizationRepository` + `OrganizationProvisioning` — sin DB.
 *
 * `withRls` se mockea para ejecutar el callback directamente (en prod envuelve
 * la transacción RLS contra Prisma; aquí no queremos DB). Cubre:
 *  - listOrganizations: filtros kind/status pasan al repo, paginación default
 *  - createOrganization: validaciones (nombre, admin, RFC) + bootstrap + admin
 *  - createClientOrganizationOnly: NO llama ensureAdmin
 *  - suspendOrganization: bloquea ROOT (org 1) y marca SUSPENDED
 *  - activateOrganization: marca ACTIVE
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/platform/db/rls.server.js", () => ({
  withRls: async <T>(
    _orgId: bigint,
    _opts: { bypass?: boolean },
    work: () => Promise<T>,
  ): Promise<T> => work(),
}));

// Los adapters concretos (composition root `defaultDeps`) importan Prisma /
// `@coco/db` transitivamente, que no resuelve bajo vitest. Como TODOS los tests
// inyectan `deps` con stubs in-memory, los defaults nunca se ejecutan: basta
// stubear los módulos de los adapters para cortar la cadena de import.
vi.mock(
  "~/contexts/organizations/infrastructure/PrismaOrganizationRepository.js",
  () => ({ PrismaOrganizationRepository: class {} }),
);
vi.mock(
  "~/contexts/organizations/infrastructure/CocoDbOrganizationProvisioning.js",
  () => ({ CocoDbOrganizationProvisioning: class {} }),
);

import {
  activateOrganization,
  createClientOrganizationOnly,
  createOrganization,
  listOrganizations,
  suspendOrganization,
  OrganizationValidationError,
  type OrganizationServiceDeps,
} from "~/contexts/organizations/application/organizationService.js";
import type {
  CreateOrganizationData,
  ListOrganizationsPaging,
  ListOrganizationsWhere,
  OrganizationRecord,
  UpdateOrganizationData,
} from "~/contexts/organizations/domain/ports/OrganizationRepository.js";
import type { ProvisionAdminInput } from "~/contexts/organizations/domain/ports/OrganizationProvisioning.js";

function makeRecord(over: Partial<OrganizationRecord> = {}): OrganizationRecord {
  return {
    id: 5n,
    nombre: "Acme",
    rfc: null,
    razonSocial: null,
    logoUrl: null,
    timezone: "America/Mexico_City",
    baseCurrency: "MXN",
    kind: "CLIENT",
    status: "CONFIGURING",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...over,
  };
}

type Calls = {
  list: Array<{ where: ListOrganizationsWhere; paging: ListOrganizationsPaging }>;
  create: CreateOrganizationData[];
  update: Array<{ id: bigint; data: UpdateOrganizationData }>;
  bootstrap: Array<{ id: bigint; opts?: { includeDittaSuperAdmin?: boolean } }>;
  ensureAdmin: Array<{ id: bigint; input: ProvisionAdminInput }>;
};

function makeDeps(
  opts: {
    rows?: OrganizationRecord[];
    total?: number;
    createResult?: OrganizationRecord;
    updateResult?: OrganizationRecord;
  } = {},
): { deps: OrganizationServiceDeps; calls: Calls } {
  const calls: Calls = {
    list: [],
    create: [],
    update: [],
    bootstrap: [],
    ensureAdmin: [],
  };
  const deps: OrganizationServiceDeps = {
    repo: {
      async list(where, paging) {
        calls.list.push({ where, paging });
        return { rows: opts.rows ?? [], total: opts.total ?? (opts.rows?.length ?? 0) };
      },
      async findById() {
        return null;
      },
      async create(data) {
        calls.create.push(data);
        return opts.createResult ?? makeRecord({ id: 9n, ...data });
      },
      async update(id, data) {
        calls.update.push({ id, data });
        return opts.updateResult ?? makeRecord({ id, ...data });
      },
    },
    provisioning: {
      async bootstrapCatalogs(id, o) {
        calls.bootstrap.push({ id, opts: o });
      },
      async ensureAdmin(id, input) {
        calls.ensureAdmin.push({ id, input });
      },
    },
  };
  return { deps, calls };
}

describe("listOrganizations", () => {
  it("pasa filtros kind/status al repo y usa paginación default", async () => {
    const { deps, calls } = makeDeps({ rows: [makeRecord()], total: 1 });
    const res = await listOrganizations({ kind: "CLIENT", status: "ACTIVE" }, deps);

    expect(calls.list).toHaveLength(1);
    expect(calls.list[0]!.where).toEqual({ kind: "CLIENT", status: "ACTIVE" });
    expect(calls.list[0]!.paging).toEqual({ page: 1, pageSize: 25 });
    expect(res.total).toBe(1);
    expect(res.data[0]!.id).toBe("5");
  });

  it("omite filtros vacíos del where", async () => {
    const { deps, calls } = makeDeps();
    await listOrganizations({}, deps);
    expect(calls.list[0]!.where).toEqual({});
  });
});

describe("createOrganization", () => {
  it("crea org, bootstrappea catálogos y crea admin inicial", async () => {
    const { deps, calls } = makeDeps({
      createResult: makeRecord({ id: 42n, nombre: "Nueva" }),
    });
    const res = await createOrganization(
      {
        nombre: "Nueva",
        adminEmail: "admin@nueva.mx",
        adminPassword: "secret123",
      },
      deps,
    );

    expect(calls.create[0]!.kind).toBe("CLIENT");
    expect(calls.create[0]!.status).toBe("CONFIGURING");
    expect(calls.bootstrap).toEqual([
      { id: 42n, opts: { includeDittaSuperAdmin: false } },
    ]);
    expect(calls.ensureAdmin).toHaveLength(1);
    expect(calls.ensureAdmin[0]!.input.userName).toBe("admin");
    expect(calls.ensureAdmin[0]!.input.email).toBe("admin@nueva.mx");
    expect(res.organization.id).toBe("42");
  });

  it("rechaza nombre vacío", async () => {
    const { deps } = makeDeps();
    await expect(
      createOrganization(
        { nombre: "  ", adminEmail: "a@b.mx", adminPassword: "x" },
        deps,
      ),
    ).rejects.toBeInstanceOf(OrganizationValidationError);
  });

  it("rechaza si falta admin email/password", async () => {
    const { deps } = makeDeps();
    await expect(
      createOrganization(
        { nombre: "Org", adminEmail: "", adminPassword: "" },
        deps,
      ),
    ).rejects.toBeInstanceOf(OrganizationValidationError);
  });

  it("rechaza RFC inválido", async () => {
    const { deps } = makeDeps();
    await expect(
      createOrganization(
        {
          nombre: "Org",
          rfc: "NOPE",
          adminEmail: "a@b.mx",
          adminPassword: "x",
        },
        deps,
      ),
    ).rejects.toBeInstanceOf(OrganizationValidationError);
  });
});

describe("createClientOrganizationOnly", () => {
  it("crea org y bootstrappea, pero NO crea admin", async () => {
    const { deps, calls } = makeDeps({
      createResult: makeRecord({ id: 7n }),
    });
    await createClientOrganizationOnly({ nombre: "SoloOrg" }, deps);
    expect(calls.create).toHaveLength(1);
    expect(calls.bootstrap).toHaveLength(1);
    expect(calls.ensureAdmin).toHaveLength(0);
  });
});

describe("suspendOrganization", () => {
  it("marca SUSPENDED para una org cliente", async () => {
    const { deps, calls } = makeDeps({
      updateResult: makeRecord({ id: 3n, status: "SUSPENDED" }),
    });
    const res = await suspendOrganization("3", deps);
    expect(calls.update[0]).toEqual({ id: 3n, data: { status: "SUSPENDED" } });
    expect(res.status).toBe("SUSPENDED");
  });

  it("bloquea suspender la org ROOT (id 1)", async () => {
    const { deps, calls } = makeDeps();
    await expect(suspendOrganization(1n, deps)).rejects.toBeInstanceOf(
      OrganizationValidationError,
    );
    expect(calls.update).toHaveLength(0);
  });
});

describe("activateOrganization", () => {
  it("marca ACTIVE", async () => {
    const { deps, calls } = makeDeps({
      updateResult: makeRecord({ id: 8n, status: "ACTIVE" }),
    });
    const res = await activateOrganization(8n, deps);
    expect(calls.update[0]).toEqual({ id: 8n, data: { status: "ACTIVE" } });
    expect(res.status).toBe("ACTIVE");
  });
});

beforeEach(() => {
  vi.clearAllMocks();
});
