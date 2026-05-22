/**
 * @module index
 * @description API pública del slice accounts-payable.
 */

export type { Poliza } from "~/contexts/accounts-payable/domain/entities/Poliza";
export type { PolizaRepository } from "~/contexts/accounts-payable/domain/ports/PolizaRepository";
export type { AccountingExporter } from "~/contexts/accounts-payable/domain/ports/AccountingExporter";
export { AccountsPayableError, PolizaNotFoundError, PolizaAlreadyExportedError, InvalidAccountingDataError } from "~/contexts/accounts-payable/domain/errors";

// @ts-ignore — JS module
export { attendTravelRequest, validateReceipts, getExpenseValidations } from "~/contexts/accounts-payable/application/accountsPayableService.js";
// @ts-ignore — JS module
export { exportPolizaByRequest, exportPolizasByRange, buildAnticipoPolizaForAdvance } from "~/contexts/accounts-payable/application/accountingExportService.js";
// @ts-ignore — JS module
export { resolveGlCatalog, resolveCompCode, costCenterRequiredAccountsFor } from "~/contexts/accounts-payable/application/polizaCatalogService.js";
