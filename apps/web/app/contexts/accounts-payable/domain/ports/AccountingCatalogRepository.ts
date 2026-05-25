/**
 * @module AccountingCatalogRepository
 * @description Puerto de acceso al catálogo contable (cuentas, indicadores de
 * impuesto, tipos de comprobante, mapeos y centros de costo) por organización.
 * El adapter concreto vive en `infrastructure/` (Prisma para los catálogos
 * persistidos — tipos de comprobante y centros de costo derivados de
 * Department — y defaults seed tipados para los catálogos contables estáticos
 * cuya persistencia 1:1 con el legacy era de estado local en la vista).
 */
import type {
  AccountingAccount,
  AccountingCatalogSnapshot,
  CostCenter,
  ExpenseTypeMapping,
  ReceiptTypeCatalogItem,
  TaxIndicator,
} from "~/contexts/accounts-payable/domain/entities/AccountingCatalog";

export type NewAccountingAccount = Omit<
  AccountingAccount,
  "accounting_account_id" | "org_id"
>;
export type NewTaxIndicator = Omit<TaxIndicator, "tax_indicator_id" | "org_id">;
export type NewExpenseTypeMapping = Omit<
  ExpenseTypeMapping,
  "expense_type_mapping_id" | "org_id"
>;
export type NewCostCenter = Omit<CostCenter, "cost_center_id">;

export interface AccountingCatalogRepository {
  /** Snapshot completo del catálogo para precargar las vistas admin. */
  loadSnapshot(orgId: number): Promise<AccountingCatalogSnapshot>;

  listAccounts(orgId: number): Promise<AccountingAccount[]>;
  createAccount(orgId: number, input: NewAccountingAccount): Promise<AccountingAccount>;
  updateAccount(
    orgId: number,
    id: number,
    patch: Partial<NewAccountingAccount>,
  ): Promise<AccountingAccount>;
  deleteAccount(orgId: number, id: number): Promise<void>;

  listTaxIndicators(orgId: number): Promise<TaxIndicator[]>;
  createTaxIndicator(orgId: number, input: NewTaxIndicator): Promise<TaxIndicator>;
  updateTaxIndicator(
    orgId: number,
    id: number,
    patch: Partial<NewTaxIndicator>,
  ): Promise<TaxIndicator>;
  deleteTaxIndicator(orgId: number, id: number): Promise<void>;

  listReceiptTypes(orgId: number): Promise<ReceiptTypeCatalogItem[]>;

  listMappings(orgId: number): Promise<ExpenseTypeMapping[]>;
  createMapping(orgId: number, input: NewExpenseTypeMapping): Promise<ExpenseTypeMapping>;
  updateMapping(
    orgId: number,
    id: number,
    patch: Partial<NewExpenseTypeMapping>,
  ): Promise<ExpenseTypeMapping>;
  deleteMapping(orgId: number, id: number): Promise<void>;

  listCostCenters(orgId: number): Promise<CostCenter[]>;
  createCostCenter(orgId: number, input: NewCostCenter): Promise<CostCenter>;
  updateCostCenter(
    orgId: number,
    id: number,
    patch: Partial<NewCostCenter>,
  ): Promise<CostCenter>;
  deleteCostCenter(orgId: number, id: number): Promise<void>;
}
