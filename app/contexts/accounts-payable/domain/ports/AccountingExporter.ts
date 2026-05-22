/**
 * @module AccountingExporter
 * @description Puerto del slice. Los adapters concretos viven en
 * `infrastructure/`. Los métodos están tipados como `unknown[]` por ahora —
 * tipar fuertemente queda como hardening de Fase 6.
 */
export interface AccountingExporter {
  exportByRequest(...args: unknown[]): Promise<unknown>;
  exportByRange(...args: unknown[]): Promise<unknown>;
}
