// @ts-nocheck — slice partially typed; pre-existing Prisma mismatches
/**
 * @module legacyAdapters (workflow slice)
 * @description Adapter thin que envuelve `approverResolver.js` del slice
 * approvals (que sigue en `.js` legacy). Cumple el port
 * `ApproverResolverPort` para que el slice workflow se mantenga hexagonal.
 * Cuando approvals migre sus sub-features (approverResolver, etc.) a
 * hexagonal proper, este adapter se elimina e importamos directo de la API
 * pública de approvals.
 */
import { resolveN1N2Approvers as legacyResolveN1N2Approvers } from "~/contexts/approvals/application/approverResolver.js";

import type { ApproverResolverPort } from "~/contexts/workflow/domain/ports/ApproverResolverPort.js";
import type { TransactionLike } from "~/contexts/workflow/domain/ports/WorkflowRuleRepository.js";
import type { ApproverResolution } from "~/contexts/workflow/domain/entities/WorkflowSnapshot.js";

export class LegacyApproverResolverAdapter implements ApproverResolverPort {
  async resolveN1N2Approvers(
    tx: TransactionLike,
    organizationId: bigint,
    departmentId: number | null | undefined,
    userId: number,
  ): Promise<ApproverResolution> {
    const result = await legacyResolveN1N2Approvers(tx, organizationId, departmentId, userId);
    return {
      n1UserId: result?.n1UserId ?? null,
      n2UserId: result?.n2UserId ?? null,
      approverIds: Array.isArray(result?.approverIds)
        ? result.approverIds.map((x: unknown) => (x === null || x === undefined ? null : Number(x)))
        : [],
    };
  }
}
