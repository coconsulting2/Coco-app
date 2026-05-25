/**
 * Unit tests de `polizaCatalogService` — resolución de catálogo GL y COMP_CODE
 * SAP desde el chartOfAccounts / sociedades de la organización, con fallback a
 * los defaults de `accountingCatalogs`. Lógica pura, sin DB.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("~/platform/logger/log/logger.js", () => ({
  Logger: () => ({ info() {}, warn() {}, error() {}, trace() {}, debug() {} }),
}));

import {
  resolveGlCatalogFromAccounts,
  resolveCompCodeFromSocieties,
  resolveGlCatalog,
  resolveCompCode,
  costCenterRequiredAccountsFor,
} from "~/contexts/accounts-payable/application/polizaCatalogService";
import { GL_ACCOUNTS, SOCIEDAD_DEFAULT } from "@coco/shared-config/accountingCatalogs";

describe("resolveGlCatalogFromAccounts", () => {
  it("devuelve los defaults GL cuando no hay cuentas", () => {
    const gl = resolveGlCatalogFromAccounts([]);
    expect(gl).toEqual({
      anticipo: GL_ACCOUNTS.ANTICIPO,
      cxp: GL_ACCOUNTS.CUENTA_POR_PAGAR_EMPLEADO,
      gasto: GL_ACCOUNTS.GASTO_DE_VIAJE,
      iva: GL_ACCOUNTS.IVA_ACREDITABLE,
    });
  });

  it("accountType tiene prioridad sobre accountCode al resolver", () => {
    const gl = resolveGlCatalogFromAccounts([
      { accountCode: "999999", accountType: "GastoViaje" },
      { accountCode: "888888", accountType: "Anticipo" },
    ]);
    expect(gl.gasto).toBe("999999");
    expect(gl.anticipo).toBe("888888");
  });

  it("ignora cuentas inactivas (active=false)", () => {
    const gl = resolveGlCatalogFromAccounts([
      { accountCode: "777777", accountType: "Iva", active: false },
    ]);
    expect(gl.iva).toBe(GL_ACCOUNTS.IVA_ACREDITABLE);
  });
});

describe("resolveCompCodeFromSocieties", () => {
  it("usa la sociedad por defecto cuando no hay sociedades", () => {
    expect(resolveCompCodeFromSocieties([])).toBe(
      String(SOCIEDAD_DEFAULT).trim().slice(0, 4),
    );
  });

  it("toma la primera sociedad ordenada por código (4 chars)", () => {
    expect(resolveCompCodeFromSocieties([{ code: "2000" }, { code: "1000" }])).toBe("1000");
  });

  it("trunca códigos largos a 4 chars", () => {
    expect(resolveCompCodeFromSocieties([{ code: "ABCDEFG" }])).toBe("ABCD");
  });
});

describe("resolveGlCatalog / resolveCompCode desde request", () => {
  it("lee organization.chartOfAccounts y accountingSocieties", () => {
    const request = {
      organization: {
        chartOfAccounts: [{ accountCode: "111111", accountType: "Anticipo" }],
        accountingSocieties: [{ code: "3000" }],
      },
    };
    expect(resolveGlCatalog(request).anticipo).toBe("111111");
    expect(resolveCompCode(request)).toBe("3000");
  });

  it("tolera request null/undefined con defaults", () => {
    expect(resolveGlCatalog(null).gasto).toBe(GL_ACCOUNTS.GASTO_DE_VIAJE);
    expect(resolveCompCode(undefined)).toBe(String(SOCIEDAD_DEFAULT).trim().slice(0, 4));
  });
});

describe("costCenterRequiredAccountsFor", () => {
  it("incluye la cuenta de gasto como cuenta que exige CeCo", () => {
    const gl = resolveGlCatalogFromAccounts([]);
    const set = costCenterRequiredAccountsFor(gl);
    expect(set.has(gl.gasto)).toBe(true);
    expect(set.has(gl.anticipo)).toBe(false);
  });
});
