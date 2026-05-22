/**
 * @module OrganizationRepository
 * @description Puerto del slice. Los adapters concretos viven en
 * `infrastructure/`. Los métodos están tipados como `unknown[]` por ahora —
 * tipar fuertemente queda como hardening de Fase 6.
 */
export interface OrganizationRepository {
  list(...args: unknown[]): Promise<unknown>;
  findById(...args: unknown[]): Promise<unknown>;
  create(...args: unknown[]): Promise<unknown>;
  update(...args: unknown[]): Promise<unknown>;
  suspend(...args: unknown[]): Promise<unknown>;
}
