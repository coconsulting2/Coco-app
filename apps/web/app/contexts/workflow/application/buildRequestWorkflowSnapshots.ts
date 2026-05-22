/**
 * @module buildRequestWorkflowSnapshots
 * @description Use-case puro con DI: construye snapshots pre/post para
 * persistir en Request (solo solicitudes nuevas / confirmadas).
 *
 * Reemplaza al legacy `buildRequestWorkflowSnapshots.js`. Las deps se
 * inyectan por parámetro — el composition root en `index.ts` provee la
 * versión pre-wired con adapters concretos.
 */
import type {
  WorkflowRuleRepository,
  TransactionLike,
} from "~/contexts/workflow/domain/ports/WorkflowRuleRepository.js";
import type { WorkflowEngine } from "~/contexts/workflow/domain/ports/WorkflowEngine.js";
import type { ApproverResolverPort } from "~/contexts/workflow/domain/ports/ApproverResolverPort.js";
import type { WorkflowSnapshot } from "~/contexts/workflow/domain/entities/WorkflowSnapshot.js";

export type BuildSnapshotsInput = {
  userId: number;
  organizationId: bigint | number | null | undefined;
  departmentId: number | null | undefined;
  requestedFee: number | string | undefined;
  destinationCountryIds: number[];
  receiptTypeIds?: number[];
  orgLevel?: number | null;
  currency?: string;
};

export type BuildSnapshotsDeps = {
  rules: WorkflowRuleRepository;
  engine: WorkflowEngine;
  approverResolver: ApproverResolverPort;
};

export async function buildRequestWorkflowSnapshots(
  tx: TransactionLike,
  opts: BuildSnapshotsInput,
  deps: BuildSnapshotsDeps,
): Promise<{ pre: WorkflowSnapshot | null; post: WorkflowSnapshot | null }> {
  const {
    userId,
    organizationId,
    departmentId,
    requestedFee,
    destinationCountryIds,
    receiptTypeIds = [],
    orgLevel = null,
    currency = "MXN",
  } = opts;

  if (organizationId === null || organizationId === undefined) {
    return { pre: null, post: null };
  }

  const oid =
    typeof organizationId === "bigint" ? organizationId : BigInt(organizationId);

  const rules = await deps.rules.listActiveRulesForOrg(tx, oid);
  const approvers = await deps.approverResolver.resolveN1N2Approvers(
    tx,
    oid,
    departmentId,
    userId,
  );

  const ctx = {
    amount: Number(requestedFee) || 0,
    currency,
    destinationCountryIds: destinationCountryIds || [],
    receiptTypeIds,
    orgLevel,
    departmentId: departmentId ?? null,
  };

  const pre = deps.engine.buildSnapshot(rules, ctx, "pre", approvers);
  const post = deps.engine.buildSnapshot(rules, ctx, "post", approvers);

  return { pre, post };
}
