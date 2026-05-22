/**
 * @module FxProvider
 * @description Puerto del slice. Los adapters concretos viven en
 * `infrastructure/`. Los métodos están tipados como `unknown[]` por ahora —
 * tipar fuertemente queda como hardening de Fase 6.
 */
export interface FxProvider {
  getRate(...args: unknown[]): Promise<unknown>;
  convertAmount(...args: unknown[]): Promise<unknown>;
  supportedCurrencies(...args: unknown[]): Promise<unknown>;
}
