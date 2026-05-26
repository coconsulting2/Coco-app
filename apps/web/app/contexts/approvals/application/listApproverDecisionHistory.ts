/**
 * @module listApproverDecisionHistory
 * @description Use-case que devuelve el HISTÓRICO de decisiones de un aprobador
 * (N1/N2): solicitudes que él ya aprobó / rechazó / reasignó / escaló. Recibe el
 * `ApproverDecisionHistoryQueries` por DI. Distinto de `getApprovalInbox`
 * (bandeja de pendientes).
 */
import type {
  ApproverDecisionHistoryQueries,
  ApproverDecisionHistoryItem,
  ApproverDecisionHistoryOpts,
} from "~/contexts/approvals/domain/ports/ApproverDecisionHistoryQueries.js";

export type ListApproverDecisionHistoryDeps = {
  historyQueries: ApproverDecisionHistoryQueries;
};

export async function listApproverDecisionHistory(
  approverUserId: number,
  opts: ApproverDecisionHistoryOpts,
  deps: ListApproverDecisionHistoryDeps,
): Promise<ApproverDecisionHistoryItem[]> {
  if (!Number.isFinite(approverUserId) || approverUserId < 1) return [];
  return deps.historyQueries.findByApprover(approverUserId, opts);
}
