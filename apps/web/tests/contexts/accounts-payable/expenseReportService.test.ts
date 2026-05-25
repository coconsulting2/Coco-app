/**
 * Unit tests de la agregación pura de `expenseReportService`:
 *  - `mapReceiptTypeToReportCategory`: normaliza tipos de comprobante a categorías.
 *  - `mapValidationToReportStatus`: mapea validación + estatus a estado del reporte.
 *  - `canViewOrganizationExpenseReport`: alcance org-wide por permisos.
 *  - `buildExpensesByCostCenterReport`: agrega comprobantes por CC/periodo usando
 *    un cliente Prisma stub in-memory (sin DB), incluyendo filtros y scope team.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("~/platform/logger/log/logger.js", () => ({
  Logger: () => ({ info() {}, warn() {}, error() {}, trace() {}, debug() {} }),
}));

import {
  mapReceiptTypeToReportCategory,
  mapValidationToReportStatus,
  canViewOrganizationExpenseReport,
  buildExpensesByCostCenterReport,
  type ExpenseReportPrismaClient,
} from "~/contexts/accounts-payable/application/expenseReportService";

describe("mapReceiptTypeToReportCategory", () => {
  it("clasifica por palabras clave (acentos insensibles)", () => {
    expect(mapReceiptTypeToReportCategory("Vuelo nacional")).toBe("VIAJE_NACIONAL");
    expect(mapReceiptTypeToReportCategory("Hospedaje Hotel")).toBe("HOSPEDAJE");
    expect(mapReceiptTypeToReportCategory("Alimentos")).toBe("ALIMENTOS");
    expect(mapReceiptTypeToReportCategory("Taxi al aeropuerto")).toBe("TRANSPORTE");
    expect(mapReceiptTypeToReportCategory("Papelería")).toBe("OTROS");
    expect(mapReceiptTypeToReportCategory(null)).toBe("OTROS");
  });
});

describe("mapValidationToReportStatus", () => {
  it("Aprobado + status 8 (Finalizado) → paid", () => {
    expect(mapValidationToReportStatus("Aprobado", 8)).toBe("paid");
  });
  it("Aprobado en otro status → approved", () => {
    expect(mapValidationToReportStatus("Aprobado", 5)).toBe("approved");
  });
  it("Rechazado → rejected, Pendiente → submitted", () => {
    expect(mapValidationToReportStatus("Rechazado", 8)).toBe("rejected");
    expect(mapValidationToReportStatus("Pendiente", 8)).toBe("submitted");
  });
});

describe("canViewOrganizationExpenseReport", () => {
  it("true con permiso org-wide", () => {
    expect(canViewOrganizationExpenseReport(new Set(["expense:view"]))).toBe(true);
    expect(canViewOrganizationExpenseReport(new Set(["policy:manage"]))).toBe(true);
  });
  it("false sin permiso o sin set", () => {
    expect(canViewOrganizationExpenseReport(new Set(["other"]))).toBe(false);
    expect(canViewOrganizationExpenseReport(undefined)).toBe(false);
  });
});

type ReceiptRow = {
  amount: number;
  validation: string;
  submissionDate: Date | null;
  validationDate: Date | null;
  receiptType: { receiptTypeName: string | null } | null;
  request: {
    userId: number | null;
    requestStatusId: number | null;
    creationDate: Date | null;
    user: { department: { departmentId: number; costsCenter: string | null; departmentName: string } | null } | null;
  } | null;
};

function stubClient(receipts: ReceiptRow[], departments: unknown[]): ExpenseReportPrismaClient {
  return {
    receipt: {
      findMany: async () => receipts as unknown[],
    },
    department: {
      findMany: async () => departments,
    },
  };
}

function receipt(over: Partial<ReceiptRow> = {}): ReceiptRow {
  return {
    amount: 100,
    validation: "Aprobado",
    submissionDate: new Date("2026-03-15T12:00:00.000Z"),
    validationDate: null,
    receiptType: { receiptTypeName: "Hotel" },
    request: {
      userId: 7,
      requestStatusId: 8,
      creationDate: new Date("2026-03-01T00:00:00.000Z"),
      user: { department: { departmentId: 1, costsCenter: "CC01", departmentName: "Ventas" } },
    },
    ...over,
  };
}

describe("buildExpensesByCostCenterReport", () => {
  it("agrega filas por centro de costo y periodo mensual (scope organization)", async () => {
    const client = stubClient(
      [receipt(), receipt({ amount: 50, receiptType: { receiptTypeName: "Taxi" } })],
      [{ departmentId: 1, costsCenter: "CC01", departmentName: "Ventas" }],
    );
    const report = await buildExpensesByCostCenterReport(client, {}, 1n, {
      visibleUserIds: null,
    });
    expect(report.scope).toBe("organization");
    expect(report.team_member_count).toBeNull();
    expect(report.rows).toHaveLength(2);
    expect(report.rows[0]!.period).toBe("2026-03");
    expect(report.rows[0]!.cost_center_code).toBe("CC01");
    expect(report.rows.find((r) => r.expense_type === "HOSPEDAJE")).toBeTruthy();
    expect(report.rows.find((r) => r.expense_type === "TRANSPORTE")).toBeTruthy();
    expect(report.budgets).toHaveLength(1);
  });

  it("scope team filtra por visibleUserIds y reporta team_member_count", async () => {
    const client = stubClient(
      [receipt({ request: { ...receipt().request!, userId: 7 } }), receipt({ request: { ...receipt().request!, userId: 99 } })],
      [{ departmentId: 1, costsCenter: "CC01", departmentName: "Ventas" }],
    );
    const report = await buildExpensesByCostCenterReport(client, {}, 1n, {
      visibleUserIds: [7],
    });
    expect(report.scope).toBe("team");
    expect(report.team_member_count).toBe(1);
    expect(report.rows).toHaveLength(1);
  });

  it("aplica filtro por tipo de gasto", async () => {
    const client = stubClient(
      [receipt({ receiptType: { receiptTypeName: "Hotel" } }), receipt({ receiptType: { receiptTypeName: "Taxi" } })],
      [],
    );
    const report = await buildExpensesByCostCenterReport(client, { expenseType: ["HOSPEDAJE"] }, 1n, {
      visibleUserIds: null,
    });
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]!.expense_type).toBe("HOSPEDAJE");
  });

  it("agrupa por trimestre cuando period=quarterly", async () => {
    const client = stubClient([receipt()], []);
    const report = await buildExpensesByCostCenterReport(client, { period: "quarterly" }, 1n, {
      visibleUserIds: null,
    });
    expect(report.rows[0]!.period).toBe("2026-Q1");
  });
});
