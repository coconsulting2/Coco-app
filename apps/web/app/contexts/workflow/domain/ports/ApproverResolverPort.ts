/**
 * @module ApproverResolverPort
 * @description Cross-slice dependency: el slice workflow necesita resolver
 * los approvers N1/N2 de una solicitud (lógica que vive en el slice
 * `approvals`). Definimos el contrato AQUÍ para que workflow no importe
 * approvals directo — el adapter concreto en `infrastructure/legacyAdapters.ts`
 * envuelve el legacy `approverResolver.js` mientras ese módulo no se migre
 * a hexagonal proper.
 */
import type { ApproverResolution } from "~/contexts/workflow/domain/entities/WorkflowSnapshot.js";
import type { TransactionLike } from "~/contexts/workflow/domain/ports/WorkflowRuleRepository.js";

export interface ApproverResolverPort {
  resolveN1N2Approvers(
    tx: TransactionLike,
    organizationId: bigint,
    departmentId: number | null | undefined,
    userId: number,
  ): Promise<ApproverResolution>;
}
