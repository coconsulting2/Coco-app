/**
 * @module PrismaAccountingCatalogRepository
 * @description Adapter del puerto `AccountingCatalogRepository`.
 *
 * Persistencia por catálogo:
 *  - **Centros de costo**: persistidos en la tabla `Department` (campo
 *    `costsCenter` = código, `departmentName` = nombre). La jerarquía
 *    parent/child no tiene columna propia en el esquema actual, por lo que se
 *    expone plana (`parent_id = null`) — paridad con el dato real disponible.
 *  - **Tipos de comprobante**: leídos de `ReceiptType` por organización.
 *  - **Cuentas contables / indicadores de impuesto / mapeos**: en el legacy
 *    vivían como estado local de la vista (sin tabla Prisma). El adapter sirve
 *    los defaults seed como snapshot y, en mutación, valida y devuelve la
 *    entidad resultante sin un store persistente — paridad 1:1 con el
 *    comportamiento legacy de estos catálogos.
 */
import prisma from "~/platform/db/prisma.server.js";
import type {
  AccountingAccount,
  AccountingCatalogSnapshot,
  CostCenter,
  ExpenseTypeMapping,
  ReceiptTypeCatalogItem,
  TaxIndicator,
} from "~/contexts/accounts-payable/domain/entities/AccountingCatalog";
import type {
  AccountingCatalogRepository,
  NewAccountingAccount,
  NewCostCenter,
  NewExpenseTypeMapping,
  NewTaxIndicator,
} from "~/contexts/accounts-payable/domain/ports/AccountingCatalogRepository";
import {
  seedAccounts,
  seedMappings,
  seedTaxIndicators,
} from "~/contexts/accounts-payable/infrastructure/accountingCatalogSeed.js";

function nextId<T>(items: T[], key: (item: T) => number): number {
  return items.reduce((max, item) => Math.max(max, key(item)), 0) + 1;
}

export class PrismaAccountingCatalogRepository implements AccountingCatalogRepository {
  async loadSnapshot(orgId: number): Promise<AccountingCatalogSnapshot> {
    const [receiptTypes, costCenters, accounts, taxIndicators, mappings] =
      await Promise.all([
        this.listReceiptTypes(orgId),
        this.listCostCenters(orgId),
        this.listAccounts(orgId),
        this.listTaxIndicators(orgId),
        this.listMappings(orgId),
      ]);
    return { accounts, taxIndicators, receiptTypes, mappings, costCenters };
  }

  // ── Cuentas contables (seed, sin tabla Prisma) ──────────────────────────
  async listAccounts(orgId: number): Promise<AccountingAccount[]> {
    return seedAccounts(orgId);
  }

  async createAccount(
    orgId: number,
    input: NewAccountingAccount,
  ): Promise<AccountingAccount> {
    const existing = seedAccounts(orgId);
    return {
      accounting_account_id: nextId(existing, (a) => a.accounting_account_id),
      org_id: orgId,
      ...input,
    };
  }

  async updateAccount(
    orgId: number,
    id: number,
    patch: Partial<NewAccountingAccount>,
  ): Promise<AccountingAccount> {
    const current =
      seedAccounts(orgId).find((a) => a.accounting_account_id === id) ??
      seedAccounts(orgId)[0]!;
    return { ...current, accounting_account_id: id, org_id: orgId, ...patch };
  }

  async deleteAccount(): Promise<void> {
    // Sin store persistente — la vista reconcilia su estado local.
  }

  // ── Indicadores de impuesto (seed, sin tabla Prisma) ────────────────────
  async listTaxIndicators(orgId: number): Promise<TaxIndicator[]> {
    return seedTaxIndicators(orgId);
  }

  async createTaxIndicator(
    orgId: number,
    input: NewTaxIndicator,
  ): Promise<TaxIndicator> {
    const existing = seedTaxIndicators(orgId);
    return {
      tax_indicator_id: nextId(existing, (t) => t.tax_indicator_id),
      org_id: orgId,
      ...input,
    };
  }

  async updateTaxIndicator(
    orgId: number,
    id: number,
    patch: Partial<NewTaxIndicator>,
  ): Promise<TaxIndicator> {
    const current =
      seedTaxIndicators(orgId).find((t) => t.tax_indicator_id === id) ??
      seedTaxIndicators(orgId)[0]!;
    return { ...current, tax_indicator_id: id, org_id: orgId, ...patch };
  }

  async deleteTaxIndicator(): Promise<void> {
    // Sin store persistente.
  }

  // ── Tipos de comprobante (Prisma) ───────────────────────────────────────
  async listReceiptTypes(orgId: number): Promise<ReceiptTypeCatalogItem[]> {
    const rows = await prisma.receiptType.findMany({
      where: { organizationId: BigInt(orgId) },
      orderBy: { receiptTypeName: "asc" },
    });
    return rows.map((r) => ({
      receipt_type_id: r.receiptTypeId,
      name: r.receiptTypeName,
    }));
  }

  // ── Mapeos tipo-de-gasto (seed, sin tabla Prisma) ───────────────────────
  async listMappings(orgId: number): Promise<ExpenseTypeMapping[]> {
    return seedMappings(orgId);
  }

  async createMapping(
    orgId: number,
    input: NewExpenseTypeMapping,
  ): Promise<ExpenseTypeMapping> {
    const existing = seedMappings(orgId);
    return {
      expense_type_mapping_id: nextId(existing, (m) => m.expense_type_mapping_id),
      org_id: orgId,
      ...input,
    };
  }

  async updateMapping(
    orgId: number,
    id: number,
    patch: Partial<NewExpenseTypeMapping>,
  ): Promise<ExpenseTypeMapping> {
    const current =
      seedMappings(orgId).find((m) => m.expense_type_mapping_id === id) ??
      seedMappings(orgId)[0]!;
    return {
      ...current,
      expense_type_mapping_id: id,
      org_id: orgId,
      ...patch,
    };
  }

  async deleteMapping(): Promise<void> {
    // Sin store persistente.
  }

  // ── Centros de costo (Prisma: Department) ───────────────────────────────
  async listCostCenters(orgId: number): Promise<CostCenter[]> {
    const departments = await prisma.department.findMany({
      where: { organizationId: BigInt(orgId), active: true, costsCenter: { not: null } },
      orderBy: { costsCenter: "asc" },
    });
    return departments.map((d) => ({
      cost_center_id: d.departmentId,
      code: d.costsCenter ?? "",
      name: d.departmentName,
      parent_id: null,
    }));
  }

  async createCostCenter(orgId: number, input: NewCostCenter): Promise<CostCenter> {
    const created = await prisma.department.create({
      data: {
        organizationId: BigInt(orgId),
        departmentName: input.name,
        costsCenter: input.code,
        active: true,
      },
    });
    return {
      cost_center_id: created.departmentId,
      code: created.costsCenter ?? input.code,
      name: created.departmentName,
      parent_id: null,
    };
  }

  async updateCostCenter(
    orgId: number,
    id: number,
    patch: Partial<NewCostCenter>,
  ): Promise<CostCenter> {
    const updated = await prisma.department.update({
      where: { departmentId: id },
      data: {
        ...(patch.name !== undefined ? { departmentName: patch.name } : {}),
        ...(patch.code !== undefined ? { costsCenter: patch.code } : {}),
      },
    });
    return {
      cost_center_id: updated.departmentId,
      code: updated.costsCenter ?? "",
      name: updated.departmentName,
      parent_id: null,
    };
  }

  async deleteCostCenter(_orgId: number, id: number): Promise<void> {
    await prisma.department.update({
      where: { departmentId: id },
      data: { active: false },
    });
  }
}
