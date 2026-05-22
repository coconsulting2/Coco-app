/**
 * @module CfdiRepository
 * @description Puerto del slice. Los adapters concretos viven en
 * `infrastructure/`. Los métodos están tipados como `unknown[]` por ahora —
 * tipar fuertemente queda como hardening de Fase 6.
 */
export interface CfdiRepository {
  findByUuid(...args: unknown[]): Promise<unknown>;
  validateWithSat(...args: unknown[]): Promise<unknown>;
}
