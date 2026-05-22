/**
 * @module getApprovalInbox
 * @description Use-case que devuelve la bandeja del aprobador (N1 o N2).
 * Recibe el `ApprovalInboxQueries` por DI.
 */
import type {
  ApprovalInboxQueries,
  ApprovalInboxItem,
  ApprovalInboxQueryOpts,
} from "~/contexts/approvals/domain/ports/ApprovalInboxQueries.js";

export type GetApprovalInboxDeps = { inboxQueries: ApprovalInboxQueries };

export async function getApprovalInbox(
  actorUserId: number,
  statusId: 2 | 3,
  opts: ApprovalInboxQueryOpts,
  deps: GetApprovalInboxDeps,
): Promise<ApprovalInboxItem[]> {
  return deps.inboxQueries.findByApprover(actorUserId, statusId, opts);
}
