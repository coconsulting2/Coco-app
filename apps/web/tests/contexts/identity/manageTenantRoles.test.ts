/**
 * Unit tests de los use-cases hex de CRUD de tenant roles (`manageTenantRoles`)
 * con un stub in-memory del puerto `TenantRolesAdminService` — sin DB ni legacy.
 * Verifica que cada use-case delega correctamente al puerto con DI y propaga
 * argumentos + resultado + errores tal cual.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("~/platform/logger/log/logger.js", () => ({
  Logger: () => ({ info() {}, warn() {}, error() {}, trace() {}, debug() {} }),
}));

import {
  createTenantRole,
  updateTenantRole,
  deleteTenantRole,
} from "~/contexts/identity/application/manageTenantRoles.js";
import type {
  TenantRolesAdminService,
  TenantRoleAdminRow,
  CreateTenantRoleInput,
  UpdateTenantRoleInput,
} from "~/contexts/identity/domain/ports/TenantRolesAdminService.js";

function makeAdminRow(over: Partial<TenantRoleAdminRow> = {}): TenantRoleAdminRow {
  return {
    role_id: 10,
    name: "Autorizador regional",
    permissions: ["viajes.autorizar.n1"],
    max_authorization_amount: 50000,
    expiration_date: null,
    is_admin: false,
    active_users_count: 0,
    is_system: false,
    ...over,
  };
}

function makeServiceStub(over: Partial<TenantRolesAdminService> = {}): TenantRolesAdminService {
  return {
    listTenantRolesForAdmin: vi.fn(async () => []),
    listRbacPermissions: vi.fn(async () => []),
    listRbacPermissionGroups: vi.fn(async () => []),
    createTenantRole: vi.fn(async (_input: CreateTenantRoleInput) => makeAdminRow()),
    updateTenantRole: vi.fn(async (_roleId: number, _input: UpdateTenantRoleInput) =>
      makeAdminRow(),
    ),
    deleteTenantRole: vi.fn(async (_roleId: number) => undefined),
    ...over,
  };
}

describe("manageTenantRoles use-cases", () => {
  describe("createTenantRole", () => {
    it("delega el payload al puerto y devuelve la fila creada", async () => {
      const created = makeAdminRow({ role_id: 42, name: "Director de área" });
      const service = makeServiceStub({
        createTenantRole: vi.fn(async () => created),
      });
      const input: CreateTenantRoleInput = {
        name: "Director de área",
        permissions: ["reportes.ver"],
        max_authorization_amount: 100000,
        expiration_date: null,
        is_admin: false,
      };

      const result = await createTenantRole(input, { service });

      expect(service.createTenantRole).toHaveBeenCalledWith(input);
      expect(result).toBe(created);
    });

    it("propaga errores del puerto", async () => {
      const service = makeServiceStub({
        createTenantRole: vi.fn(async () => {
          throw new Error("Ya existe un rol con ese nombre en la organización");
        }),
      });

      await expect(
        createTenantRole(
          {
            name: "dup",
            permissions: [],
            max_authorization_amount: null,
            expiration_date: null,
            is_admin: false,
          },
          { service },
        ),
      ).rejects.toThrow("Ya existe un rol con ese nombre");
    });
  });

  describe("updateTenantRole", () => {
    it("delega roleId + payload al puerto y devuelve la fila actualizada", async () => {
      const updated = makeAdminRow({ role_id: 7, max_authorization_amount: 999 });
      const service = makeServiceStub({
        updateTenantRole: vi.fn(async () => updated),
      });
      const input: UpdateTenantRoleInput = { max_authorization_amount: 999 };

      const result = await updateTenantRole(7, input, { service });

      expect(service.updateTenantRole).toHaveBeenCalledWith(7, input);
      expect(result).toBe(updated);
    });

    it("soporta payload parcial (solo monto, roles de sistema)", async () => {
      const service = makeServiceStub();
      await updateTenantRole(3, { max_authorization_amount: null }, { service });
      expect(service.updateTenantRole).toHaveBeenCalledWith(3, {
        max_authorization_amount: null,
      });
    });
  });

  describe("deleteTenantRole", () => {
    it("delega el roleId al puerto", async () => {
      const service = makeServiceStub();
      await deleteTenantRole(15, { service });
      expect(service.deleteTenantRole).toHaveBeenCalledWith(15);
    });

    it("propaga el error de usuarios activos", async () => {
      const service = makeServiceStub({
        deleteTenantRole: vi.fn(async () => {
          throw new Error("No se puede eliminar un rol con usuarios activos; reasígnalos antes.");
        }),
      });

      await expect(deleteTenantRole(15, { service })).rejects.toThrow(
        "usuarios activos",
      );
    });
  });
});
