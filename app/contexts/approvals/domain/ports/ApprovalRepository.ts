/**
 * @module ApprovalRepository
 * @description Puerto del slice. Los adapters concretos viven en
 * `infrastructure/`. Los métodos están tipados como `unknown[]` por ahora —
 * tipar fuertemente queda como hardening de Fase 6.
 */
export interface ApprovalRepository {
  findPendingForApprover(...args: unknown[]): Promise<unknown>;
  approve(...args: unknown[]): Promise<unknown>;
  reject(...args: unknown[]): Promise<unknown>;
  reassign(...args: unknown[]): Promise<unknown>;
}
