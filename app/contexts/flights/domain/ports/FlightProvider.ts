/**
 * @module FlightProvider
 * @description Puerto del slice. Los adapters concretos viven en
 * `infrastructure/`. Los métodos están tipados como `unknown[]` por ahora —
 * tipar fuertemente queda como hardening de Fase 6.
 */
export interface FlightProvider {
  search(...args: unknown[]): Promise<unknown>;
  quote(...args: unknown[]): Promise<unknown>;
}
