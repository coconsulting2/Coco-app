/**
 * @module AccountingExportQueries
 * @description Puerto de lectura/construcción de pólizas contables para el
 * use-case `getAccountingPolizasInRange`. El adapter concreto vive en
 * `infrastructure/` y envuelve la lógica SAT/GL legacy (construcción +
 * persistencia transaccional), exponiéndola con una firma tipada.
 */
import type { AccountingPoliza } from "~/contexts/accounts-payable/domain/entities/AccountingPoliza";

export type GetPolizasInRangeOptions = {
  /** Si true, incluye Requests ya exportados (re-export / vista de sincronizados). */
  force?: boolean;
};

export interface AccountingExportQueries {
  /**
   * Construye y persiste las pólizas de todos los Requests finalizados con
   * validaciones de comprobante en el rango [from, to].
   */
  getPolizasInRange(
    from: Date,
    to: Date,
    options?: GetPolizasInRangeOptions,
  ): Promise<AccountingPoliza[]>;
}
