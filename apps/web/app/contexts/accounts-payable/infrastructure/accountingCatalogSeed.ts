/**
 * @module accountingCatalogSeed
 * @description Defaults seed tipados de los catálogos contables que en el legacy
 * vivían como estado local en la vista (`AccountingAccountAdmin`,
 * `TaxIndicatorAdmin`, `ExpenseTypeMappingAdmin`) — sin tabla Prisma propia.
 * El adapter usa estos defaults como snapshot inicial cuando la organización
 * aún no tiene un catálogo contable propio persistido. Paridad 1:1 con los
 * `SEED_*` de los componentes legacy.
 */
import type {
  AccountingAccount,
  ExpenseTypeMapping,
  TaxIndicator,
} from "~/contexts/accounts-payable/domain/entities/AccountingCatalog";

export function seedAccounts(orgId: number): AccountingAccount[] {
  return [
    { accounting_account_id: 1, org_id: orgId, account_number: "6100-001", description: "Gastos de viaje · Avión", type: "GASTOS", currency: "MXN" },
    { accounting_account_id: 2, org_id: orgId, account_number: "6100-002", description: "Gastos de viaje · Hotel", type: "GASTOS", currency: "MXN" },
    { accounting_account_id: 3, org_id: orgId, account_number: "1107-001", description: "Anticipos a empleados", type: "ANTICIPOS", currency: "MXN" },
    { accounting_account_id: 4, org_id: orgId, account_number: "2102-001", description: "Cuentas por pagar · Proveedores", type: "ACREEDORES", currency: "MXN" },
    { accounting_account_id: 5, org_id: orgId, account_number: "6100-USD-001", description: "Gastos de viaje · Internacional", type: "GASTOS", currency: "USD" },
  ];
}

export function seedTaxIndicators(orgId: number): TaxIndicator[] {
  return [
    { tax_indicator_id: 1, org_id: orgId, key: "IVA16", description: "IVA 16% acreditable", percentage: 16, type: "IVA_TRASLADADO" },
    { tax_indicator_id: 2, org_id: orgId, key: "IVA08", description: "IVA 8% zona fronteriza", percentage: 8, type: "IVA_TRASLADADO" },
    { tax_indicator_id: 3, org_id: orgId, key: "RET-IVA", description: "Retención de IVA 10.67%", percentage: 10.67, type: "IVA_RETENIDO" },
    { tax_indicator_id: 4, org_id: orgId, key: "RET-ISR", description: "Retención de ISR 10%", percentage: 10, type: "ISR_RETENIDO" },
  ];
}

export function seedMappings(orgId: number): ExpenseTypeMapping[] {
  return [
    { expense_type_mapping_id: 1, org_id: orgId, receipt_type_id: 1, cargo_account_id: 1, abono_account_id: 4, tax_indicator_id: 1 },
    { expense_type_mapping_id: 2, org_id: orgId, receipt_type_id: 2, cargo_account_id: 2, abono_account_id: 4, tax_indicator_id: 1 },
  ];
}
