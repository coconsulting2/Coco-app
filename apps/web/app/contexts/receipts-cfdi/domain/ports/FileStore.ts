/**
 * @module FileStore
 * @description Puerto del slice. Los adapters concretos viven en
 * `infrastructure/`. Los métodos están tipados como `unknown[]` por ahora —
 * tipar fuertemente queda como hardening de Fase 6.
 */
export interface FileStore {
  upload(...args: unknown[]): Promise<unknown>;
  download(...args: unknown[]): Promise<unknown>;
  remove(...args: unknown[]): Promise<unknown>;
}
