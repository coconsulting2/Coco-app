/**
 * @module getAccountingPolizasInRange
 * @description Use-case puro con DI: obtiene las pólizas contables (AV/GV) de
 * los Requests finalizados cuyo comprobante fue validado en un rango de fechas.
 * Réplica de la lógica de validación del controller legacy
 * `accountingExportController.exportContable`:
 *   - `from` es obligatorio y debe ser fecha válida.
 *   - `to` por defecto = ahora; debe ser fecha válida.
 *   - `from` debe ser <= `to`.
 * La construcción SAT/GL densa vive detrás del port (adapter en infrastructure/).
 */
import type { AccountingPoliza } from "~/contexts/accounts-payable/domain/entities/AccountingPoliza";
import type { AccountingExportQueries } from "~/contexts/accounts-payable/domain/ports/AccountingExportQueries";
import { InvalidAccountingDataError } from "~/contexts/accounts-payable/domain/errors";

export type GetAccountingPolizasInRangeInput = {
  /** Fecha de inicio del rango (obligatoria, YYYY-MM-DD o Date). */
  from: Date | string;
  /** Fecha de fin del rango (opcional, default = ahora). */
  to?: Date | string | null;
  /** Si true, incluye Requests ya sincronizados/exportados. */
  force?: boolean;
};

export type GetAccountingPolizasInRangeDeps = {
  exportQueries: AccountingExportQueries;
};

export type GetAccountingPolizasInRangeResult = {
  polizas: AccountingPoliza[];
  from: string;
  to: string;
};

function toIsoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDate(value: Date | string | null | undefined): Date | null {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function getAccountingPolizasInRange(
  input: GetAccountingPolizasInRangeInput,
  deps: GetAccountingPolizasInRangeDeps,
): Promise<GetAccountingPolizasInRangeResult> {
  const fromDate = parseDate(input.from);
  if (!fromDate) {
    throw new InvalidAccountingDataError(
      "'from' es requerido y debe ser una fecha válida (YYYY-MM-DD)",
    );
  }

  const toDate = input.to != null && input.to !== "" ? parseDate(input.to) : new Date();
  if (!toDate) {
    throw new InvalidAccountingDataError("'to' debe ser una fecha válida (YYYY-MM-DD)");
  }

  if (fromDate.getTime() > toDate.getTime()) {
    throw new InvalidAccountingDataError("'from' debe ser anterior o igual a 'to'");
  }

  const polizas = await deps.exportQueries.getPolizasInRange(fromDate, toDate, {
    force: Boolean(input.force),
  });

  return {
    polizas,
    from: toIsoDay(fromDate),
    to: toIsoDay(toDate),
  };
}
