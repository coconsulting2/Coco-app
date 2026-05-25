/**
 * @module accountingCatalogUseCases
 * @description Use-cases hexagonales (DI por parámetro) del catálogo contable:
 * carga del snapshot + CRUD de cuentas contables, indicadores de impuesto,
 * mapeos tipo-de-gasto y centros de costo. La validación replica 1:1 la del
 * legacy (`AccountingAccountAdmin`, `TaxIndicatorAdmin`, `ExpenseTypeMappingAdmin`,
 * `CostCenterAdmin`): formatos de clave/código, unicidad, rangos de porcentaje,
 * cargo ≠ abono y no-ciclos en la jerarquía de centros de costo. La persistencia
 * vive detrás del port `AccountingCatalogRepository`.
 */
import type {
  AccountingAccount,
  AccountingAccountType,
  AccountingCatalogSnapshot,
  CostCenter,
  ExpenseTypeMapping,
  TaxIndicator,
  TaxIndicatorType,
} from "~/contexts/accounts-payable/domain/entities/AccountingCatalog";
import type {
  AccountingCatalogRepository,
  NewAccountingAccount,
  NewCostCenter,
  NewExpenseTypeMapping,
  NewTaxIndicator,
} from "~/contexts/accounts-payable/domain/ports/AccountingCatalogRepository";
import { InvalidAccountingDataError } from "~/contexts/accounts-payable/domain/errors";

export type CatalogDeps = { catalog: AccountingCatalogRepository };

const ACCOUNT_TYPES: AccountingAccountType[] = ["ANTICIPOS", "GASTOS", "ACREEDORES"];
const TAX_INDICATOR_TYPES: TaxIndicatorType[] = [
  "IVA_TRASLADADO",
  "IVA_RETENIDO",
  "ISR_RETENIDO",
];

function invalid(message: string): never {
  throw new InvalidAccountingDataError(message);
}

// ── Snapshot ─────────────────────────────────────────────────────────────
export async function loadAccountingCatalog(
  orgId: number,
  deps: CatalogDeps,
): Promise<AccountingCatalogSnapshot> {
  return deps.catalog.loadSnapshot(orgId);
}

// ── Cuentas contables ──────────────────────────────────────────────────────
export interface AccountingAccountInput {
  account_number: string;
  description: string;
  type: AccountingAccountType;
  currency: string;
}

function validateAccount(
  input: AccountingAccountInput,
  existing: AccountingAccount[],
  editingId?: number,
): NewAccountingAccount {
  const accountNumber = input.account_number.trim();
  const description = input.description.trim();
  const currency = input.currency.trim().toUpperCase();

  if (!accountNumber) invalid("El número de cuenta es requerido");
  if (!/^[A-Za-z0-9_-]{3,20}$/.test(accountNumber)) {
    invalid("3–20 caracteres: letras, números, guion o guion bajo");
  }
  if (
    existing.some(
      (i) =>
        i.account_number.toLowerCase() === accountNumber.toLowerCase() &&
        i.accounting_account_id !== editingId,
    )
  ) {
    invalid("Este número de cuenta ya existe");
  }
  if (!description) invalid("La descripción es requerida");
  if (description.length > 120) invalid("Máximo 120 caracteres");
  if (!ACCOUNT_TYPES.includes(input.type)) invalid("Tipo inválido");
  if (!currency) invalid("La moneda es requerida");
  if (!/^[A-Z]{3}$/.test(currency)) {
    invalid("Usa el código ISO de 3 letras (ej. MXN, USD)");
  }

  return { account_number: accountNumber, description, type: input.type, currency };
}

export async function createAccountingAccount(
  orgId: number,
  input: AccountingAccountInput,
  deps: CatalogDeps,
): Promise<AccountingAccount> {
  const existing = await deps.catalog.listAccounts(orgId);
  const data = validateAccount(input, existing);
  return deps.catalog.createAccount(orgId, data);
}

export async function updateAccountingAccount(
  orgId: number,
  id: number,
  input: AccountingAccountInput,
  deps: CatalogDeps,
): Promise<AccountingAccount> {
  const existing = await deps.catalog.listAccounts(orgId);
  const data = validateAccount(input, existing, id);
  return deps.catalog.updateAccount(orgId, id, data);
}

export async function deleteAccountingAccount(
  orgId: number,
  id: number,
  deps: CatalogDeps,
): Promise<void> {
  const mappings = await deps.catalog.listMappings(orgId);
  const mapped = mappings.some(
    (m) => m.active !== false && (m.cargo_account_id === id || m.abono_account_id === id),
  );
  if (mapped) {
    invalid(
      "No se puede eliminar: la cuenta está asociada a un tipo de gasto activo.",
    );
  }
  await deps.catalog.deleteAccount(orgId, id);
}

// ── Indicadores de impuesto ─────────────────────────────────────────────────
export interface TaxIndicatorInput {
  key: string;
  description: string;
  percentage: number;
  type: TaxIndicatorType;
}

function validateTaxIndicator(
  input: TaxIndicatorInput,
  existing: TaxIndicator[],
  editingId?: number,
): NewTaxIndicator {
  const key = input.key.trim();
  const description = input.description.trim();
  const percentage = Number(input.percentage);

  if (!key) invalid("La clave es requerida");
  if (!/^[A-Za-z0-9_-]{2,20}$/.test(key)) {
    invalid("2–20 caracteres: letras, números, guion o guion bajo");
  }
  if (
    existing.some(
      (i) =>
        i.key.toLowerCase() === key.toLowerCase() &&
        i.tax_indicator_id !== editingId,
    )
  ) {
    invalid("Esta clave ya existe");
  }
  if (!description) invalid("La descripción es requerida");
  if (description.length > 120) invalid("Máximo 120 caracteres");
  if (Number.isNaN(percentage)) invalid("El porcentaje debe ser un número");
  if (percentage < 0) invalid("El porcentaje no puede ser negativo");
  if (percentage > 100) invalid("El porcentaje máximo es 100");
  if (!TAX_INDICATOR_TYPES.includes(input.type)) invalid("Tipo inválido");

  return { key, description, percentage, type: input.type };
}

export async function createTaxIndicator(
  orgId: number,
  input: TaxIndicatorInput,
  deps: CatalogDeps,
): Promise<TaxIndicator> {
  const existing = await deps.catalog.listTaxIndicators(orgId);
  const data = validateTaxIndicator(input, existing);
  return deps.catalog.createTaxIndicator(orgId, data);
}

export async function updateTaxIndicator(
  orgId: number,
  id: number,
  input: TaxIndicatorInput,
  deps: CatalogDeps,
): Promise<TaxIndicator> {
  const existing = await deps.catalog.listTaxIndicators(orgId);
  const data = validateTaxIndicator(input, existing, id);
  return deps.catalog.updateTaxIndicator(orgId, id, data);
}

export async function deleteTaxIndicator(
  orgId: number,
  id: number,
  deps: CatalogDeps,
): Promise<void> {
  const mappings = await deps.catalog.listMappings(orgId);
  const mapped = mappings.some(
    (m) => m.active !== false && m.tax_indicator_id === id,
  );
  if (mapped) {
    invalid(
      "No se puede eliminar: el indicador está asociado a un tipo de gasto activo.",
    );
  }
  await deps.catalog.deleteTaxIndicator(orgId, id);
}

// ── Mapeos tipo-de-gasto ────────────────────────────────────────────────────
export interface ExpenseTypeMappingInput {
  receipt_type_id: number;
  cargo_account_id: number;
  abono_account_id: number;
  tax_indicator_id: number | null;
}

function validateMapping(input: ExpenseTypeMappingInput): NewExpenseTypeMapping {
  if (!Number.isFinite(input.receipt_type_id)) invalid("Selecciona un tipo de gasto");
  if (!Number.isFinite(input.cargo_account_id)) invalid("Selecciona la cuenta de cargo");
  if (!Number.isFinite(input.abono_account_id)) invalid("Selecciona la cuenta de abono");
  if (input.cargo_account_id === input.abono_account_id) {
    invalid("La cuenta de abono debe ser distinta del cargo");
  }
  return {
    receipt_type_id: input.receipt_type_id,
    cargo_account_id: input.cargo_account_id,
    abono_account_id: input.abono_account_id,
    tax_indicator_id: input.tax_indicator_id,
  };
}

export async function createExpenseTypeMapping(
  orgId: number,
  input: ExpenseTypeMappingInput,
  deps: CatalogDeps,
): Promise<ExpenseTypeMapping> {
  const data = validateMapping(input);
  const existing = await deps.catalog.listMappings(orgId);
  if (
    existing.some(
      (m) => m.active !== false && m.receipt_type_id === data.receipt_type_id,
    )
  ) {
    invalid("Este tipo de gasto ya tiene un mapeo activo.");
  }
  return deps.catalog.createMapping(orgId, data);
}

export async function updateExpenseTypeMapping(
  orgId: number,
  id: number,
  input: ExpenseTypeMappingInput,
  deps: CatalogDeps,
): Promise<ExpenseTypeMapping> {
  const data = validateMapping(input);
  return deps.catalog.updateMapping(orgId, id, data);
}

export async function deleteExpenseTypeMapping(
  orgId: number,
  id: number,
  deps: CatalogDeps,
): Promise<void> {
  await deps.catalog.deleteMapping(orgId, id);
}

// ── Centros de costo ────────────────────────────────────────────────────────
export interface CostCenterInput {
  code: string;
  name: string;
  parent_id: number | null;
}

function validateCostCenter(
  input: CostCenterInput,
  existing: CostCenter[],
  editingId?: number,
): NewCostCenter {
  const code = input.code.trim();
  const name = input.name.trim();

  if (!code) invalid("El código es requerido");
  if (!/^[A-Za-z0-9_-]{2,20}$/.test(code)) {
    invalid("2–20 caracteres: letras, números, guion o guion bajo");
  }
  if (
    existing.some(
      (i) => i.code.toLowerCase() === code.toLowerCase() && i.cost_center_id !== editingId,
    )
  ) {
    invalid("Este código ya existe");
  }
  if (!name) invalid("El nombre es requerido");
  if (name.length > 80) invalid("Máximo 80 caracteres");
  if (input.parent_id != null && input.parent_id === editingId) {
    invalid("Un centro no puede ser su propio padre");
  }

  return { code, name, parent_id: input.parent_id };
}

/** Conjunto de descendientes (incl. el propio nodo) para impedir ciclos. */
function descendantIds(items: CostCenter[], rootId: number): Set<number> {
  const childrenByParent = new Map<number, CostCenter[]>();
  for (const cc of items) {
    if (cc.parent_id == null) continue;
    const list = childrenByParent.get(cc.parent_id) ?? [];
    list.push(cc);
    childrenByParent.set(cc.parent_id, list);
  }
  const result = new Set<number>([rootId]);
  const stack = [rootId];
  while (stack.length) {
    const current = stack.pop()!;
    for (const child of childrenByParent.get(current) ?? []) {
      if (!result.has(child.cost_center_id)) {
        result.add(child.cost_center_id);
        stack.push(child.cost_center_id);
      }
    }
  }
  return result;
}

export async function createCostCenter(
  orgId: number,
  input: CostCenterInput,
  deps: CatalogDeps,
): Promise<CostCenter> {
  const existing = await deps.catalog.listCostCenters(orgId);
  const data = validateCostCenter(input, existing);
  return deps.catalog.createCostCenter(orgId, data);
}

export async function updateCostCenter(
  orgId: number,
  id: number,
  input: CostCenterInput,
  deps: CatalogDeps,
): Promise<CostCenter> {
  const existing = await deps.catalog.listCostCenters(orgId);
  const data = validateCostCenter(input, existing, id);
  if (data.parent_id != null && descendantIds(existing, id).has(data.parent_id)) {
    invalid("Un centro no puede tener como padre a uno de sus descendientes");
  }
  return deps.catalog.updateCostCenter(orgId, id, data);
}

export async function deleteCostCenter(
  orgId: number,
  id: number,
  deps: CatalogDeps,
): Promise<void> {
  await deps.catalog.deleteCostCenter(orgId, id);
}
