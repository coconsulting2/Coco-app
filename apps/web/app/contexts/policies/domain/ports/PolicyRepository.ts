/**
 * @module PolicyRepository
 * @description Puerto del slice. Los adapters concretos viven en
 * `infrastructure/`. Los métodos están tipados como `unknown[]` por ahora —
 * tipar fuertemente queda como hardening de Fase 6.
 */
export interface PolicyRepository {
  list(...args: unknown[]): Promise<unknown>;
  findActive(...args: unknown[]): Promise<unknown>;
  create(...args: unknown[]): Promise<unknown>;
  update(...args: unknown[]): Promise<unknown>;
}
