/**
 * @module workflow (slice public API + composition root)
 * @description Fachada estable del slice workflow. Rutas y otros slices
 * importan SOLO desde aquí.
 *
 * Patrón hexagonal:
 *   - Use-cases en `application/*.ts` reciben dependencias por parámetro (DI).
 *   - Adapters concretos en `infrastructure/*.ts` implementan los ports del
 *     `domain/`.
 *   - Este index expone use-cases pre-wired con los adapters concretos por
 *     default (lo que rutas/loaders consumen) y EXPORTA los raw use-cases
 *     desde `application/*` para que los tests puedan inyectar stubs.
 */

// ── Domain types + ports + errores ────────────────────────────────────────
export type {
  RuleType,
  ParamType,
  WorkflowRule,
  EvaluationContext,
  ApproverResolution,
  WorkflowSnapshot,
} from "~/contexts/workflow/domain/entities/WorkflowSnapshot.js";

export type {
  RequestCommentUserView,
  RequestCommentRow,
  RequestCommentPage,
} from "~/contexts/workflow/domain/entities/RequestComment.js";

export type {
  WorkflowRuleRepository,
  WorkflowRuleInput,
  TransactionLike,
} from "~/contexts/workflow/domain/ports/WorkflowRuleRepository.js";
export type { WorkflowEngine } from "~/contexts/workflow/domain/ports/WorkflowEngine.js";
export type { ApproverResolverPort } from "~/contexts/workflow/domain/ports/ApproverResolverPort.js";
export type {
  RequestCommentRepository,
  RequestCommentInsert,
  RequestCommentQuery,
  RequestCommentRaw,
} from "~/contexts/workflow/domain/ports/RequestCommentRepository.js";

export {
  WorkflowError,
  WorkflowRuleNotFoundError,
  InvalidWorkflowConfigError,
  EscalationDeadlineMissedError,
  RequestCommentInvalidActorError,
  RequestCommentCursorTamperedError,
} from "~/contexts/workflow/domain/errors.js";

// ── Composition root (default deps) ───────────────────────────────────────
import { PrismaWorkflowRuleRepository } from "~/contexts/workflow/infrastructure/PrismaWorkflowRuleRepository.js";
import { DefaultWorkflowEngine } from "~/contexts/workflow/infrastructure/DefaultWorkflowEngine.js";
import { PrismaRequestCommentRepository } from "~/contexts/workflow/infrastructure/PrismaRequestCommentRepository.js";
import { LegacyApproverResolverAdapter } from "~/contexts/workflow/infrastructure/legacyAdapters.js";

import * as buildSnapshotsModule from "~/contexts/workflow/application/buildRequestWorkflowSnapshots.js";
import * as manageRulesModule from "~/contexts/workflow/application/manageWorkflowRules.js";
import * as manageCommentsModule from "~/contexts/workflow/application/manageRequestComments.js";

const defaultRulesRepo = new PrismaWorkflowRuleRepository();
const defaultEngine = new DefaultWorkflowEngine();
const defaultCommentsRepo = new PrismaRequestCommentRepository();
const defaultApproverResolver = new LegacyApproverResolverAdapter();

// ── Use-cases pre-wired ───────────────────────────────────────────────────

export const buildRequestWorkflowSnapshots = (
  tx: import("~/contexts/workflow/domain/ports/WorkflowRuleRepository.js").TransactionLike,
  opts: buildSnapshotsModule.BuildSnapshotsInput,
) =>
  buildSnapshotsModule.buildRequestWorkflowSnapshots(tx, opts, {
    rules: defaultRulesRepo,
    engine: defaultEngine,
    approverResolver: defaultApproverResolver,
  });

export const listWorkflowRules = (organizationId: bigint) =>
  manageRulesModule.listRules(organizationId, { rules: defaultRulesRepo });

export const getWorkflowRule = (id: bigint | number) =>
  manageRulesModule.getRule(id, { rules: defaultRulesRepo });

export const createWorkflowRule = (
  input: import("~/contexts/workflow/domain/ports/WorkflowRuleRepository.js").WorkflowRuleInput,
) => manageRulesModule.createRule(input, { rules: defaultRulesRepo });

export const updateWorkflowRule = (
  id: bigint | number,
  patch: Partial<
    import("~/contexts/workflow/domain/ports/WorkflowRuleRepository.js").WorkflowRuleInput
  >,
) => manageRulesModule.updateRule(id, patch, { rules: defaultRulesRepo });

export const createRequestComment = (
  userId: number,
  requestId: number,
  content: string,
) =>
  manageCommentsModule.createComment(userId, requestId, content, {
    comments: defaultCommentsRepo,
  });

export const readRequestComments = (
  requestId: number,
  userId: number,
  limit: number,
  opts: manageCommentsModule.ReadCommentsOpts = {},
) =>
  manageCommentsModule.readComments(requestId, userId, limit, opts, {
    comments: defaultCommentsRepo,
  });

/**
 * Helper expuesto para callers que solo quieren el siguiente request_status
 * a partir de un nivel ya conocido (sin reconstruir snapshot).
 */
export const initialStatusFromLevels = (levels: number[]): number =>
  defaultEngine.initialStatusFromLevels(levels);

export const statusAfterN1Approval = (levels: number[]): number =>
  defaultEngine.statusAfterN1Approval(levels);

export const statusAfterN2Approval = (): number =>
  defaultEngine.statusAfterN2Approval();

// ── Raw use-cases (para tests + composiciones custom) ────────────────────
export const usecases = {
  buildRequestWorkflowSnapshots: buildSnapshotsModule.buildRequestWorkflowSnapshots,
  listRules: manageRulesModule.listRules,
  getRule: manageRulesModule.getRule,
  createRule: manageRulesModule.createRule,
  updateRule: manageRulesModule.updateRule,
  createComment: manageCommentsModule.createComment,
  readComments: manageCommentsModule.readComments,
} as const;

export const adapters = {
  WorkflowRuleRepository: PrismaWorkflowRuleRepository,
  WorkflowEngine: DefaultWorkflowEngine,
  RequestCommentRepository: PrismaRequestCommentRepository,
  ApproverResolverPort: LegacyApproverResolverAdapter,
} as const;
