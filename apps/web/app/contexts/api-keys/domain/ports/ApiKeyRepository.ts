/**
 * @module ApiKeyRepository
 * @description Puerto del slice. Los adapters concretos viven en
 * `infrastructure/`. Los métodos están tipados como `unknown[]` por ahora —
 * tipar fuertemente queda como hardening de Fase 6.
 */
export interface ApiKeyRepository {
  list(...args: unknown[]): Promise<unknown>;
  create(...args: unknown[]): Promise<unknown>;
  rotate(...args: unknown[]): Promise<unknown>;
  revoke(...args: unknown[]): Promise<unknown>;
  validate(...args: unknown[]): Promise<unknown>;
}
