/**
 * Unit tests de la lógica pura SAT/GL de `accountingExportService`:
 *  - `buildAnticipoPolizaForAdvance`: póliza AV balanceada (Debe=Anticipo,
 *    Haber=CxP) para un anticipo > 0; null si el monto no aplica.
 *  - `resolveVendorAndCostCenter`: proveedor desde empleado o derivado del userId.
 *  - `polizasToXml`: serialización XML con root <Polizas>.
 *  - `isAccountingExportStrictLengths`: lectura del flag de entorno.
 * No toca DB: solo el builder y los helpers en memoria.
 */
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("~/platform/logger/log/logger.js", () => ({
  Logger: () => ({ info() {}, warn() {}, error() {}, trace() {}, debug() {} }),
}));

import {
  buildAnticipoPolizaForAdvance,
  resolveVendorAndCostCenter,
  isAccountingExportStrictLengths,
} from "~/contexts/accounts-payable/application/accountingExportService";
import AccountingExportService from "~/contexts/accounts-payable/application/accountingExportService";
import { DOC_TYPES, SHKZG, proveedorFromUserId } from "@coco/shared-config/accountingCatalogs";
import type { PolizaBuildRequest } from "~/contexts/accounts-payable/application/accountingExportService";

function baseRequest(overrides: Partial<PolizaBuildRequest> = {}): PolizaBuildRequest {
  return {
    requestId: 42,
    userId: 7,
    organization: {
      chartOfAccounts: [],
      accountingSocieties: [{ code: "1000" }],
    } as unknown as PolizaBuildRequest["organization"],
    ...overrides,
  };
}

describe("buildAnticipoPolizaForAdvance", () => {
  it("devuelve null si el anticipo es <= 0", () => {
    expect(buildAnticipoPolizaForAdvance(baseRequest(), 0)).toBeNull();
    expect(buildAnticipoPolizaForAdvance(baseRequest(), -5)).toBeNull();
  });

  it("construye una póliza AV balanceada Debe/Haber", () => {
    const poliza = buildAnticipoPolizaForAdvance(baseRequest(), 1234.5);
    expect(poliza).not.toBeNull();
    const p = poliza!;
    expect(p.header.DOC_TYPE).toBe(DOC_TYPES.ANTICIPO_VIAJE);
    expect(p.header.ID_VIAJE).toBe("42");
    expect(p.header.COMP_CODE).toBe("1000");
    expect(p.detalle).toHaveLength(2);

    const debe = p.detalle!.find((d) => d.SHKZG === SHKZG.DEBE)!;
    const haber = p.detalle!.find((d) => d.SHKZG === SHKZG.HABER)!;
    expect(debe.AMT_DOCCUR).toBe(1234.5);
    expect(haber.AMT_DOCCUR).toBe(1234.5);
    // Balanceada: suma Debe == suma Haber.
    expect(debe.AMT_DOCCUR).toBe(haber.AMT_DOCCUR);
  });

  it("incluye el código de empleado paddeado en ITEM_TEXT", () => {
    const p = buildAnticipoPolizaForAdvance(baseRequest({ userId: 3 }), 100)!;
    expect(p.detalle![0]!.ITEM_TEXT).toContain("#Emp003");
  });
});

describe("resolveVendorAndCostCenter", () => {
  it("usa el proveedor del empleado cuando existe", () => {
    const request = baseRequest({
      user: {
        empleado: { proveedor: "PROV123", ceco: "CC9" },
        department: { costsCenter: "DEP1" },
      } as unknown as PolizaBuildRequest["user"],
    });
    const { vendorNo, costCenter } = resolveVendorAndCostCenter(request);
    expect(vendorNo).toBe("PROV123");
    expect(costCenter).toBe("CC9");
  });

  it("deriva el proveedor del userId cuando no hay empleado", () => {
    const { vendorNo } = resolveVendorAndCostCenter(baseRequest({ userId: 7, user: null }));
    expect(vendorNo).toBe(proveedorFromUserId(7));
  });
});

describe("polizasToXml", () => {
  it("serializa con declaración XML y root <Polizas>", () => {
    const poliza = buildAnticipoPolizaForAdvance(baseRequest(), 500)!;
    const xml = AccountingExportService.polizasToXml([poliza]);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<Polizas>");
    expect(xml).toContain("<Cabecera>");
    expect(xml).toContain("<Detalle>");
  });
});

describe("isAccountingExportStrictLengths", () => {
  const original = process.env.ACCOUNTING_EXPORT_STRICT_LENGTHS;
  afterEach(() => {
    if (original === undefined) delete process.env.ACCOUNTING_EXPORT_STRICT_LENGTHS;
    else process.env.ACCOUNTING_EXPORT_STRICT_LENGTHS = original;
  });

  it("true con '1' o 'true'", () => {
    process.env.ACCOUNTING_EXPORT_STRICT_LENGTHS = "1";
    expect(isAccountingExportStrictLengths()).toBe(true);
    process.env.ACCOUNTING_EXPORT_STRICT_LENGTHS = "true";
    expect(isAccountingExportStrictLengths()).toBe(true);
  });

  it("false en otro caso", () => {
    process.env.ACCOUNTING_EXPORT_STRICT_LENGTHS = "0";
    expect(isAccountingExportStrictLengths()).toBe(false);
    delete process.env.ACCOUNTING_EXPORT_STRICT_LENGTHS;
    expect(isAccountingExportStrictLengths()).toBe(false);
  });
});
