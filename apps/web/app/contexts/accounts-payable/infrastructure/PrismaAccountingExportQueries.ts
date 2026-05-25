/**
 * @module PrismaAccountingExportQueries
 * @description Adapter del puerto `AccountingExportQueries`. Envuelve el
 * servicio `AccountingExportService` (lógica SAT/GL + persistencia transaccional
 * vía las queries de `infrastructure/`), exponiéndolo con la firma tipada que el
 * use-case `getAccountingPolizasInRange` consume.
 */
import AccountingExportService from "~/contexts/accounts-payable/application/accountingExportService.js";
import type {
  AccountingExportQueries,
  GetPolizasInRangeOptions,
} from "~/contexts/accounts-payable/domain/ports/AccountingExportQueries";
import type { AccountingPoliza } from "~/contexts/accounts-payable/domain/entities/AccountingPoliza";

export class PrismaAccountingExportQueries implements AccountingExportQueries {
  async getPolizasInRange(
    from: Date,
    to: Date,
    options?: GetPolizasInRangeOptions,
  ): Promise<AccountingPoliza[]> {
    return AccountingExportService.getPolizasInRange(from, to, {
      force: Boolean(options?.force),
    });
  }
}
