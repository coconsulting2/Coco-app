/**
 * @module PolicyEngine
 * @description Puerto del slice. Los adapters concretos viven en
 * `infrastructure/`. Los métodos están tipados como `unknown[]` por ahora —
 * tipar fuertemente queda como hardening de Fase 6.
 */
export interface PolicyEngine {
  evaluate(...args: unknown[]): Promise<unknown>;
  buildSnapshot(...args: unknown[]): Promise<unknown>;
}
