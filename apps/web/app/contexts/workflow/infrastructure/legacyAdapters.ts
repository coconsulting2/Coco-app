/**
 * @module legacyAdapters (workflow slice)
 * @description Adapter thin que envuelve `resolveN1N2Approvers` del slice
 * approvals (ya migrado a `.ts`). Cumple el port `ApproverResolverPort` para
 * que el slice workflow se mantenga hexagonal sin importar approvals directo
 * desde sus use-cases.
 *
 * El `TransactionLike` del port es `unknown` (dominio puro); aquí, en el
 * boundary de infraestructura, lo adaptamos al shape estructural `Db` que el
 * resolver espera. El cast vive SOLO en este adapter.
 */
import { resolveN1N2Approvers as legacyResolveN1N2Approvers } from "~/contexts/approvals/application/approverResolver.js";

import type { ApproverResolverPort } from "~/contexts/workflow/domain/ports/ApproverResolverPort.js";
import type { TransactionLike } from "~/contexts/workflow/domain/ports/WorkflowRuleRepository.js";
import type { ApproverResolution } from "~/contexts/workflow/domain/entities/WorkflowSnapshot.js";

/** Shape del cliente Prisma que el resolver consume (boundary cast). */
type ResolverDb = Parameters<typeof legacyResolveN1N2Approvers>[0];

export class LegacyApproverResolverAdapter implements ApproverResolverPort {
  async resolveN1N2Approvers(
    tx: TransactionLike,
    organizationId: bigint,
    departmentId: number | null | undefined,
    userId: number,
  ): Promise<ApproverResolution> {
    const result = await legacyResolveN1N2Approvers(
      tx as ResolverDb,
      organizationId,
      departmentId,
      userId,
    );
    return {
      n1UserId: result.n1UserId ?? null,
      n2UserId: result.n2UserId ?? null,
      approverIds: Array.isArray(result.approverIds)
        ? result.approverIds.map((x) => (x === null || x === undefined ? null : Number(x)))
        : [],
    };
  }
}
