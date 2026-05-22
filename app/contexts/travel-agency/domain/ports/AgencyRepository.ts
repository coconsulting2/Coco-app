/**
 * @module AgencyRepository
 * @description Puerto del slice. Los adapters concretos viven en
 * `infrastructure/`. Los métodos están tipados como `unknown[]` por ahora —
 * tipar fuertemente queda como hardening de Fase 6.
 */
export interface AgencyRepository {
  listPendingAttentions(...args: unknown[]): Promise<unknown>;
  saveAttention(...args: unknown[]): Promise<unknown>;
}
