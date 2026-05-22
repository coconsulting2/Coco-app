/**
 * @module RefundRepository
 * @description Puerto del slice. Los adapters concretos viven en
 * `infrastructure/`. Los métodos están tipados como `unknown[]` por ahora —
 * tipar fuertemente queda como hardening de Fase 6.
 */
export interface RefundRepository {
  listRules(...args: unknown[]): Promise<unknown>;
  createRule(...args: unknown[]): Promise<unknown>;
  updateRule(...args: unknown[]): Promise<unknown>;
}
