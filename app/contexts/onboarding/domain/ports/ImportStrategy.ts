/**
 * @module ImportStrategy
 * @description Puerto del slice. Los adapters concretos viven en
 * `infrastructure/`. Los métodos están tipados como `unknown[]` por ahora —
 * tipar fuertemente queda como hardening de Fase 6.
 */
export interface ImportStrategy {
  parseAndValidate(...args: unknown[]): Promise<unknown>;
  persist(...args: unknown[]): Promise<unknown>;
}
