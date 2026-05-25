/**
 * Unit tests de las estrategias de parseo (CSV/JSON) y del resolver — puros,
 * sin DB. Cubren paridad con el legacy: columnas/aliases, modo SAP, wrapper
 * JSON con roleMappings/organization, y errores de formato.
 */
import { describe, it, expect } from "vitest";

import { CsvImportStrategy } from "~/contexts/onboarding/application/strategies/CsvImportStrategy";
import {
  JsonImportStrategy,
  extractOrganizationSpecFromJsonRoot,
} from "~/contexts/onboarding/application/strategies/JsonImportStrategy";
import {
  resolveImportStrategy,
  acceptedMimeTypes,
} from "~/contexts/onboarding/application/importStrategyResolver";

const buf = (s: string): Buffer => Buffer.from(s, "utf-8");

describe("CsvImportStrategy", () => {
  it("parsea CSV estándar con header case-insensitive y aliases", async () => {
    const csv = "userName,email,role,department\npedro.ramos,pedro@cliente.mx,N1,Operaciones";
    const { rows } = await new CsvImportStrategy().parse(buf(csv));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userName: "pedro.ramos",
      email: "pedro@cliente.mx",
      roleName: "N1",
      department: "Operaciones",
      _row: 2,
    });
  });

  it("detecta separador ';' y columna manager", async () => {
    const csv = "userName;email;roleName;manager\nana;ana@x.com;Solicitante;jefe.uno";
    const { rows } = await new CsvImportStrategy().parse(buf(csv));
    expect(rows[0].managerUserName).toBe("jefe.uno");
  });

  it("modo SAP: deriva userName/email cuando falta", async () => {
    const csv = "no_empleado,nombre,ceco,proveedor\n00123,Juan Perez,CC10,9001";
    const { rows } = await new CsvImportStrategy().parse(buf(csv));
    expect(rows[0].userName).toBe("00123");
    expect(rows[0].email).toBe("00123.9001@sap.local");
    expect(rows[0].roleName).toBe("Solicitante");
    expect(rows[0].sapCeco).toBe("CC10");
    expect(rows[0].firstName).toBe("Juan");
    expect(rows[0].lastName).toBe("Perez");
  });

  it("lanza si falta columna requerida (modo estándar)", async () => {
    await expect(new CsvImportStrategy().parse(buf("email\nx@y.com\na@b.com"))).rejects.toThrow(
      /Columna requerida/,
    );
  });

  it("lanza si el CSV está vacío", async () => {
    await expect(new CsvImportStrategy().parse(buf("   "))).rejects.toThrow(/vacío/);
  });
});

describe("JsonImportStrategy", () => {
  it("parsea array directo de usuarios", async () => {
    const json = JSON.stringify([
      { userName: "ana.lopez", email: "ANA@x.com", roleName: "Solicitante", password: "Abcd1234" },
    ]);
    const { rows, embeddedRoleMappings, organizationSpec } = await new JsonImportStrategy().parse(
      buf(json),
    );
    expect(rows[0].userName).toBe("ana.lopez");
    expect(rows[0].email).toBe("ana@x.com");
    expect(embeddedRoleMappings).toEqual({});
    expect(organizationSpec).toBeNull();
  });

  it("extrae roleMappings y users del wrapper", async () => {
    const json = JSON.stringify({
      roleMappings: { Approver: "Solicitante" },
      users: [{ userName: "beto", email: "beto@x.com", role: "Approver" }],
    });
    const { rows, embeddedRoleMappings } = await new JsonImportStrategy().parse(buf(json));
    expect(rows).toHaveLength(1);
    expect(embeddedRoleMappings).toEqual({ Approver: "Solicitante" });
  });

  it("normaliza aliases SAP y status A/I", async () => {
    const json = JSON.stringify([
      {
        userName: "c.diaz",
        email: "c@x.com",
        roleName: "N2",
        no_empleado: "00500",
        manager_id: "00100",
        status: "I",
      },
    ]);
    const { rows } = await new JsonImportStrategy().parse(buf(json));
    expect(rows[0].noEmpleado).toBe("00500");
    expect(rows[0].managerNoEmpleado).toBe("00100");
    expect(rows[0].sapStatus).toBe("I");
  });

  it("lanza con JSON inválido o vacío", async () => {
    await expect(new JsonImportStrategy().parse(buf("{not json"))).rejects.toThrow(/no es válido/);
    await expect(new JsonImportStrategy().parse(buf("[]"))).rejects.toThrow(/vacío/);
    await expect(new JsonImportStrategy().parse(buf('{"foo":1}'))).rejects.toThrow(/array de usuarios/);
  });

  it("extractOrganizationSpecFromJsonRoot devuelve defaults timezone/currency", () => {
    const spec = extractOrganizationSpecFromJsonRoot({ organization: { nombre: "Acme" } });
    expect(spec).toMatchObject({
      nombre: "Acme",
      timezone: "America/Mexico_City",
      baseCurrency: "MXN",
      rfc: null,
    });
    expect(extractOrganizationSpecFromJsonRoot([])).toBeNull();
    expect(extractOrganizationSpecFromJsonRoot({ organization: {} })).toBeNull();
  });
});

describe("resolveImportStrategy", () => {
  it("resuelve por MIME type", () => {
    expect(resolveImportStrategy("application/json").label).toBe("JSON");
    expect(resolveImportStrategy("text/csv").label).toBe("CSV");
  });

  it("resuelve octet-stream por extensión", () => {
    expect(resolveImportStrategy("application/octet-stream", "data.csv").label).toBe("CSV");
    expect(resolveImportStrategy("application/octet-stream", "data.json").label).toBe("JSON");
  });

  it("lanza con tipo no soportado", () => {
    expect(() => resolveImportStrategy("image/png", "x.png")).toThrow(/no soportado/);
  });

  it("acceptedMimeTypes lista todos los tipos", () => {
    const types = acceptedMimeTypes();
    expect(types).toContain("application/json");
    expect(types).toContain("text/csv");
  });
});
