/**
 * @module index
 * @description API pública del slice accounts-payable.
 */

export type { Poliza } from "~/contexts/accounts-payable/domain/entities/Poliza";
export type { PolizaRepository } from "~/contexts/accounts-payable/domain/ports/PolizaRepository";
export type { AccountingExporter } from "~/contexts/accounts-payable/domain/ports/AccountingExporter";
export { AccountsPayableError, PolizaNotFoundError, PolizaAlreadyExportedError, InvalidAccountingDataError } from "~/contexts/accounts-payable/domain/errors";

import AccountsPayableService, {
  attendTravelRequest,
} from "~/contexts/accounts-payable/application/accountsPayableService.js";
import AccountsPayableModel from "~/contexts/accounts-payable/infrastructure/accountsPayableModel.js";

export { attendTravelRequest };
export type { CxpRequestListItem } from "~/contexts/accounts-payable/infrastructure/accountsPayableModel";
/** Valida los recibos de una solicitud y avanza/retrocede su estatus. */
export const validateReceipts = (requestId: number) =>
  AccountsPayableService.validateReceiptsAndUpdateStatus(requestId);
/** Resumen de validaciones de comprobantes de una solicitud. */
export const getExpenseValidations = (requestId: number) =>
  AccountsPayableModel.getExpenseValidations(requestId);
/** Lista todas las solicitudes visibles para Cuentas por Pagar (vista global CxP). */
export const listAllCxpRequests = () => AccountsPayableModel.getAllRequests();

export {
  resolveGlCatalog,
  resolveCompCode,
  costCenterRequiredAccountsFor,
} from "~/contexts/accounts-payable/application/polizaCatalogService.js";

// ── Use-case hexagonal: exportar pólizas contables (AV/GV) por rango ─────
export type {
  AccountingPoliza,
  AccountingPolizaHeader,
  AccountingPolizaLine,
} from "~/contexts/accounts-payable/domain/entities/AccountingPoliza";
export type {
  AccountingExportQueries,
  GetPolizasInRangeOptions,
} from "~/contexts/accounts-payable/domain/ports/AccountingExportQueries";
export type {
  GetAccountingPolizasInRangeInput,
  GetAccountingPolizasInRangeResult,
} from "~/contexts/accounts-payable/application/getAccountingPolizasInRange.js";

import { getAccountingPolizasInRange as getAccountingPolizasInRangeRaw } from "~/contexts/accounts-payable/application/getAccountingPolizasInRange.js";
import { PrismaAccountingExportQueries } from "~/contexts/accounts-payable/infrastructure/PrismaAccountingExportQueries.js";
import type { GetAccountingPolizasInRangeInput } from "~/contexts/accounts-payable/application/getAccountingPolizasInRange.js";

const defaultAccountingExportQueries = new PrismaAccountingExportQueries();

/** Use-case pre-wired: pólizas contables por rango con adapter Prisma. */
export const getAccountingPolizasInRange = (input: GetAccountingPolizasInRangeInput) =>
  getAccountingPolizasInRangeRaw(input, { exportQueries: defaultAccountingExportQueries });

/** Raw use-case + adapter para tests / wiring custom. */
export { getAccountingPolizasInRangeRaw, PrismaAccountingExportQueries };

// ── Use-case hexagonal: confirmar imposed_fee en cotización CxP ──────────
export type {
  ConfirmImposedFeeInput,
  ConfirmImposedFeeResult,
} from "~/contexts/accounts-payable/application/confirmImposedFee.js";
export type { CxpAttendRepository } from "~/contexts/accounts-payable/domain/ports/CxpAttendRepository.js";

import { PrismaCxpAttendRepository } from "~/contexts/accounts-payable/infrastructure/PrismaCxpAttendRepository.js";
import * as confirmImposedFeeModule from "~/contexts/accounts-payable/application/confirmImposedFee.js";
export {
  CxpRequestNotFoundError,
  CxpRequestNotAttendableError,
} from "~/contexts/accounts-payable/application/confirmImposedFee.js";
export type { CxpAttendState } from "~/contexts/accounts-payable/domain/ports/CxpAttendRepository.js";

const defaultCxpAttendRepo = new PrismaCxpAttendRepository();

export const confirmImposedFee = (
  input: confirmImposedFeeModule.ConfirmImposedFeeInput,
) =>
  confirmImposedFeeModule.confirmImposedFee(input, {
    attendRepo: defaultCxpAttendRepo,
  });

// ── Use-cases hexagonales: catálogo contable (cuentas, indicadores, mapeos,
//    centros de costo) — list/create/update/delete con DI ─────────────────
export type {
  AccountingAccount,
  AccountingAccountType,
  AccountingCatalogSnapshot,
  CostCenter as CostCenterEntity,
  ExpenseTypeMapping,
  ReceiptTypeCatalogItem,
  TaxIndicator,
  TaxIndicatorType,
} from "~/contexts/accounts-payable/domain/entities/AccountingCatalog";
export type {
  AccountingCatalogRepository,
} from "~/contexts/accounts-payable/domain/ports/AccountingCatalogRepository";
export type {
  AccountingAccountInput,
  CostCenterInput,
  ExpenseTypeMappingInput,
  TaxIndicatorInput,
} from "~/contexts/accounts-payable/application/accountingCatalogUseCases.js";

import * as catalogUseCases from "~/contexts/accounts-payable/application/accountingCatalogUseCases.js";
import { PrismaAccountingCatalogRepository } from "~/contexts/accounts-payable/infrastructure/PrismaAccountingCatalogRepository.js";

const defaultCatalogRepo = new PrismaAccountingCatalogRepository();
const catalogDeps = { catalog: defaultCatalogRepo };

export { PrismaAccountingCatalogRepository };

export const loadAccountingCatalog = (orgId: number) =>
  catalogUseCases.loadAccountingCatalog(orgId, catalogDeps);

export const createAccountingAccount = (
  orgId: number,
  input: catalogUseCases.AccountingAccountInput,
) => catalogUseCases.createAccountingAccount(orgId, input, catalogDeps);
export const updateAccountingAccount = (
  orgId: number,
  id: number,
  input: catalogUseCases.AccountingAccountInput,
) => catalogUseCases.updateAccountingAccount(orgId, id, input, catalogDeps);
export const deleteAccountingAccount = (orgId: number, id: number) =>
  catalogUseCases.deleteAccountingAccount(orgId, id, catalogDeps);

export const createTaxIndicator = (
  orgId: number,
  input: catalogUseCases.TaxIndicatorInput,
) => catalogUseCases.createTaxIndicator(orgId, input, catalogDeps);
export const updateTaxIndicator = (
  orgId: number,
  id: number,
  input: catalogUseCases.TaxIndicatorInput,
) => catalogUseCases.updateTaxIndicator(orgId, id, input, catalogDeps);
export const deleteTaxIndicator = (orgId: number, id: number) =>
  catalogUseCases.deleteTaxIndicator(orgId, id, catalogDeps);

export const createExpenseTypeMapping = (
  orgId: number,
  input: catalogUseCases.ExpenseTypeMappingInput,
) => catalogUseCases.createExpenseTypeMapping(orgId, input, catalogDeps);
export const updateExpenseTypeMapping = (
  orgId: number,
  id: number,
  input: catalogUseCases.ExpenseTypeMappingInput,
) => catalogUseCases.updateExpenseTypeMapping(orgId, id, input, catalogDeps);
export const deleteExpenseTypeMapping = (orgId: number, id: number) =>
  catalogUseCases.deleteExpenseTypeMapping(orgId, id, catalogDeps);

export const createCostCenter = (
  orgId: number,
  input: catalogUseCases.CostCenterInput,
) => catalogUseCases.createCostCenter(orgId, input, catalogDeps);
export const updateCostCenter = (
  orgId: number,
  id: number,
  input: catalogUseCases.CostCenterInput,
) => catalogUseCases.updateCostCenter(orgId, id, input, catalogDeps);
export const deleteCostCenter = (orgId: number, id: number) =>
  catalogUseCases.deleteCostCenter(orgId, id, catalogDeps);

// ── Use-case hexagonal: reporte de gastos por centro de costo ────────────
export type {
  ExpenseReportQueries,
  ExpenseReportQuery,
  ExpensesByCostCenterReport,
  ExpenseReportRow,
  CostCenterBudget as ExpenseReportCostCenterBudget,
} from "~/contexts/accounts-payable/domain/ports/ExpenseReportQueries";
export type {
  GetExpensesByCCInput,
} from "~/contexts/accounts-payable/application/getExpensesByCC.js";

import { getExpensesByCC as getExpensesByCCRaw } from "~/contexts/accounts-payable/application/getExpensesByCC.js";
import { PrismaExpenseReportQueries } from "~/contexts/accounts-payable/infrastructure/PrismaExpenseReportQueries.js";
import type { GetExpensesByCCInput } from "~/contexts/accounts-payable/application/getExpensesByCC.js";

const defaultExpenseReportQueries = new PrismaExpenseReportQueries();

export const getExpensesByCC = (input: GetExpensesByCCInput) =>
  getExpensesByCCRaw(input, { expenseReportQueries: defaultExpenseReportQueries });

export { getExpensesByCCRaw, PrismaExpenseReportQueries };
