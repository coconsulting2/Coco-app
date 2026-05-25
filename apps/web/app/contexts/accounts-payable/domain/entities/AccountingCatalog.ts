/**
 * @module AccountingCatalog
 * @description Entidades puras del catálogo contable administrado en CxP/Admin:
 * cuentas contables, centros de costo (jerárquicos), indicadores de impuesto,
 * tipos de comprobante y el mapeo tipo-de-gasto → cuentas (cargo/abono) +
 * indicador. Paridad 1:1 con los catálogos legacy (`AccountingAccountAdmin`,
 * `CostCenterAdmin`, `TaxIndicatorAdmin`, `ExpenseTypeMappingAdmin`).
 *
 * Estas entidades son las del dominio del slice; los componentes de UI usan los
 * tipos espejo de `@type/AccountingAccount` / `@type/CostCenter` con la misma
 * forma serializable.
 */

export type AccountingAccountType = "ANTICIPOS" | "GASTOS" | "ACREEDORES";

export interface AccountingAccount {
  accounting_account_id: number;
  org_id: number;
  account_number: string;
  description: string;
  type: AccountingAccountType;
  currency: string;
  active?: boolean;
}

export type TaxIndicatorType =
  | "IVA_TRASLADADO"
  | "IVA_RETENIDO"
  | "ISR_RETENIDO";

export interface TaxIndicator {
  tax_indicator_id: number;
  org_id: number;
  key: string;
  description: string;
  percentage: number;
  type: TaxIndicatorType;
  active?: boolean;
}

export interface ReceiptTypeCatalogItem {
  receipt_type_id: number;
  name: string;
  description?: string;
}

export interface ExpenseTypeMapping {
  expense_type_mapping_id: number;
  org_id: number;
  receipt_type_id: number;
  cargo_account_id: number;
  abono_account_id: number;
  tax_indicator_id: number | null;
  active?: boolean;
}

export interface CostCenter {
  cost_center_id: number;
  code: string;
  name: string;
  parent_id: number | null;
  active?: boolean;
}

/** Snapshot completo del catálogo contable para precargar las vistas admin. */
export interface AccountingCatalogSnapshot {
  accounts: AccountingAccount[];
  taxIndicators: TaxIndicator[];
  receiptTypes: ReceiptTypeCatalogItem[];
  mappings: ExpenseTypeMapping[];
  costCenters: CostCenter[];
}
