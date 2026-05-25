/**
 * Unit tests de la validación de filas (`validateImportRows`) y resolución de
 * roles (`resolveImportRole` / `resolveManualRoleMapping`) — puros, sin DB.
 */
import { describe, it, expect } from "vitest";

import {
  validateImportRows,
  isValidImportPassword,
  type ProcessedImportRow,
} from "~/contexts/onboarding/application/onboardingImportValidationService";
import {
  resolveImportRole,
  resolveManualRoleMapping,
} from "~/contexts/onboarding/application/importRoleResolution";

const VALID_ROLES = ["Solicitante", "N1", "N2", "Cuentas por pagar"];

function row(over: Partial<ProcessedImportRow>): ProcessedImportRow {
  return {
    userName: "ana.lopez",
    email: "ana@x.com",
    roleName: "Solicitante",
    mappedRoleName: "Solicitante",
    externalRoleLabel: null,
    ...over,
  };
}

describe("isValidImportPassword", () => {
  it("acepta contraseñas con mayúscula, minúscula, número y 8+ chars", () => {
    expect(isValidImportPassword("Abcd1234")).toBe(true);
  });
  it("rechaza débiles o no-string", () => {
    expect(isValidImportPassword("abcd1234")).toBe(false);
    expect(isValidImportPassword("Abc1")).toBe(false);
    expect(isValidImportPassword(undefined)).toBe(false);
  });
});

describe("validateImportRows", () => {
  it("acepta una fila válida", () => {
    const { valid, errors } = validateImportRows([row({})], VALID_ROLES);
    expect(valid).toHaveLength(1);
    expect(errors).toHaveLength(0);
  });

  it("marca userName inválido y email inválido", () => {
    const { valid, errors } = validateImportRows(
      [row({ userName: "AB", email: "no-email", _row: 5 })],
      VALID_ROLES,
    );
    expect(valid).toHaveLength(0);
    expect(errors.some((e) => e.field === "userName" && e.row === 5)).toBe(true);
    expect(errors.some((e) => e.field === "email")).toBe(true);
  });

  it("detecta duplicados de userName/email en el archivo", () => {
    const { errors } = validateImportRows(
      [row({ _row: 1 }), row({ _row: 2 })],
      VALID_ROLES,
    );
    expect(errors.some((e) => e.message.includes("Duplicado"))).toBe(true);
  });

  it("exige rol o etiqueta externa", () => {
    const { errors } = validateImportRows(
      [row({ mappedRoleName: null, externalRoleLabel: null })],
      VALID_ROLES,
    );
    expect(errors.some((e) => e.field === "roleName")).toBe(true);
  });

  it("rechaza rol interno no existente en la org", () => {
    const { errors } = validateImportRows(
      [row({ mappedRoleName: "Inexistente" })],
      VALID_ROLES,
    );
    expect(errors.some((e) => e.field === "roleName" && /inconsistente/.test(e.message))).toBe(true);
  });

  it("permite etiqueta externa pendiente (sin mappedRoleName)", () => {
    const { valid, errors } = validateImportRows(
      [row({ mappedRoleName: null, externalRoleLabel: "Approver" })],
      VALID_ROLES,
    );
    expect(valid).toHaveLength(1);
    expect(errors).toHaveLength(0);
  });

  it("valida formato de password del archivo si viene", () => {
    const { errors } = validateImportRows([row({ password: "weak" })], VALID_ROLES);
    expect(errors.some((e) => e.field === "password")).toBe(true);
  });
});

describe("resolveImportRole", () => {
  it("resuelve alias internos (cxp → Cuentas por pagar)", () => {
    expect(resolveImportRole("cxp", VALID_ROLES)).toEqual({
      mappedRoleName: "Cuentas por pagar",
      externalRoleLabel: null,
    });
  });

  it("resuelve por roleMappings embebido del archivo", () => {
    expect(resolveImportRole("Approver", VALID_ROLES, { Approver: "Solicitante" })).toEqual({
      mappedRoleName: "Solicitante",
      externalRoleLabel: null,
    });
  });

  it("devuelve etiqueta externa cuando no resuelve", () => {
    expect(resolveImportRole("Finance Lead", VALID_ROLES)).toEqual({
      mappedRoleName: null,
      externalRoleLabel: "Finance Lead",
    });
  });

  it("vacío → ambos null", () => {
    expect(resolveImportRole("", VALID_ROLES)).toEqual({
      mappedRoleName: null,
      externalRoleLabel: null,
    });
  });
});

describe("resolveManualRoleMapping", () => {
  it("normaliza alias y exact match contra el catálogo", () => {
    expect(resolveManualRoleMapping("n1", VALID_ROLES)).toBe("N1");
    expect(resolveManualRoleMapping("Solicitante", VALID_ROLES)).toBe("Solicitante");
  });
  it("devuelve null si no existe", () => {
    expect(resolveManualRoleMapping("Fantasma", VALID_ROLES)).toBeNull();
    expect(resolveManualRoleMapping("", VALID_ROLES)).toBeNull();
  });
});
