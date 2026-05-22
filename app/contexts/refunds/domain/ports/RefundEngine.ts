/**
 * @module RefundEngine
 * @description Puerto del slice. Los adapters concretos viven en
 * `infrastructure/`. Los métodos están tipados como `unknown[]` por ahora —
 * tipar fuertemente queda como hardening de Fase 6.
 */
export interface RefundEngine {
  evaluate(...args: unknown[]): Promise<unknown>;
  applyContext(...args: unknown[]): Promise<unknown>;
}
