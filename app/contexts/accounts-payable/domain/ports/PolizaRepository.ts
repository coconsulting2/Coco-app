/**
 * @module PolizaRepository
 * @description Puerto del slice. Los adapters concretos viven en
 * `infrastructure/`. Los métodos están tipados como `unknown[]` por ahora —
 * tipar fuertemente queda como hardening de Fase 6.
 */
export interface PolizaRepository {
  listPolizas(...args: unknown[]): Promise<unknown>;
  generatePoliza(...args: unknown[]): Promise<unknown>;
  exportPoliza(...args: unknown[]): Promise<unknown>;
}
