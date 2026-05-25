/**
 * Unit test del use-case `runOnboardingImport` con un stub in-memory del port
 * `OnboardingImportService` — sin DB. Verifica el dispatch preview/apply, el
 * paso de argumentos y la forma del resultado discriminado.
 */
import { describe, it, expect, vi } from "vitest";

// El slice importa (transitivamente) el logger pino, cuyo transport falla
// al inicializarse bajo vitest/node. Lo aislamos con un stub no-op.
vi.mock("~/platform/logger/log/logger.js", () => ({
  Logger: () => ({
    info: () => {},
    warn: () => {},
    error: () => {},
    trace: () => {},
    debug: () => {},
  }),
}));

import {
  runOnboardingImport,
  type RunOnboardingImportDeps,
} from "~/contexts/onboarding/application/runOnboardingImport";
import type { OnboardingImportService } from "~/contexts/onboarding/domain/ports/OnboardingImportService";
import type {
  ApplyImportResult,
  PreviewImportResult,
} from "~/contexts/onboarding/domain/entities/ImportUser";

const previewStub: PreviewImportResult = {
  previewToken: "prev_abc",
  strategy: "JSON",
  totalRows: 2,
  validRows: 2,
  invalidRows: 0,
  conflictRows: 0,
  needsRoleMappingCount: 0,
  unmappedExternalRoles: [],
  fileHadPasswords: false,
  preview: [],
  applyableUsernames: ["ana.lopez", "beto.ruiz"],
  permissionsCatalog: { groups: [] },
  rolesCatalog: [],
  errors: [],
  conflicts: [],
  societies: [],
  departments: [],
  newOrganizationApplyAvailable: false,
  previewCreateNewOrganization: false,
};

const applyStub: ApplyImportResult = {
  created: 2,
  skipped: 0,
  createdUsers: [
    { userId: 10, userName: "ana.lopez", email: "ana@x.com" },
    { userId: 11, userName: "beto.ruiz", email: "beto@x.com" },
  ],
  appliedBy: 7,
  failures: [],
};

function makeDeps(): { deps: RunOnboardingImportDeps; service: OnboardingImportService } {
  const service: OnboardingImportService = {
    previewImport: vi.fn(async () => previewStub),
    applyImport: vi.fn(async () => applyStub),
  };
  return { deps: { service }, service };
}

describe("runOnboardingImport", () => {
  it("dispatcha la fase preview y devuelve el resultado del servicio", async () => {
    const { deps, service } = makeDeps();
    const buffer = Buffer.from("[]", "utf-8");

    const out = await runOnboardingImport(
      {
        phase: "preview",
        buffer,
        mimetype: "application/json",
        originalname: "import.json",
        organizationId: 1n,
        actingUserId: 7,
        options: { actorHasOrganizationCreate: true },
      },
      deps,
    );

    expect(out.phase).toBe("preview");
    if (out.phase !== "preview") throw new Error("esperaba preview");
    expect(out.preview).toBe(previewStub);
    expect(service.previewImport).toHaveBeenCalledWith(
      buffer,
      "application/json",
      "import.json",
      1n,
      7,
      { actorHasOrganizationCreate: true },
    );
  });

  it("dispatcha la fase apply y devuelve el resultado del servicio", async () => {
    const { deps, service } = makeDeps();

    const out = await runOnboardingImport(
      {
        phase: "apply",
        previewToken: "prev_abc",
        organizationId: 1n,
        actingUserId: 7,
        options: { passwordGlobal: "Secreto123" },
      },
      deps,
    );

    expect(out.phase).toBe("apply");
    if (out.phase !== "apply") throw new Error("esperaba apply");
    expect(out.result).toBe(applyStub);
    expect(service.applyImport).toHaveBeenCalledWith("prev_abc", 1n, 7, {
      passwordGlobal: "Secreto123",
    });
  });

  it("no llama applyImport cuando la fase es preview (y viceversa)", async () => {
    const { deps, service } = makeDeps();
    await runOnboardingImport(
      {
        phase: "preview",
        buffer: Buffer.from("[]"),
        mimetype: "application/json",
        originalname: "x.json",
        organizationId: 1n,
        actingUserId: 1,
      },
      deps,
    );
    expect(service.applyImport).not.toHaveBeenCalled();
    expect(service.previewImport).toHaveBeenCalledTimes(1);
  });

  it("propaga errores del servicio", async () => {
    const boom = new Error("token expirado");
    const service: OnboardingImportService = {
      previewImport: vi.fn(),
      applyImport: vi.fn(async () => {
        throw boom;
      }),
    };
    await expect(
      runOnboardingImport(
        {
          phase: "apply",
          previewToken: "prev_x",
          organizationId: 1n,
          actingUserId: 1,
        },
        { service },
      ),
    ).rejects.toThrow("token expirado");
  });
});
