/**
 * @module approvals (slice public API + composition root)
 * @description Fachada estable del slice approvals. Las rutas y otros slices
 * importan SOLO desde aquí. Las use-cases reciben dependencias por DI; este
 * archivo provee la composición default usando los adapters concretos.
 */

// ── Domain types + ports + errores ────────────────────────────────────────
export type { Approval } from "~/contexts/approvals/domain/entities/Approval";
export type { ApprovalRepository } from "~/contexts/approvals/domain/ports/ApprovalRepository";
export type {
  ApprovalInboxQueries,
  ApprovalInboxItem,
  ApprovalInboxQueryOpts,
} from "~/contexts/approvals/domain/ports/ApprovalInboxQueries.js";
export type {
  AuthorizerRepository,
  RequestAuthorizationContext,
  WorkflowPreSnapshot,
  WorkflowAction,
  WorkflowActionPatch,
  AlertItem,
  GetAlertsForAuthorizerInput,
} from "~/contexts/approvals/domain/ports/AuthorizerRepository.js";
export type { WorkflowRulesPort } from "~/contexts/approvals/domain/ports/WorkflowRulesPort.js";
export type { PolicyExceptionPort, PolicyException } from "~/contexts/approvals/domain/ports/PolicyExceptionPort.js";
export type { AnticipoPolizaPort } from "~/contexts/approvals/domain/ports/AnticipoPolizaPort.js";
export type { EmployeeHierarchyPort } from "~/contexts/approvals/domain/ports/EmployeeHierarchyPort.js";

export {
  ApprovalsError,
  ApprovalNotFoundError,
  AlreadyDecidedError,
  NotAuthorizedToApproveError,
  RequestNotInAuthorizationStatusError,
  AmountExceedsLimitNoEscalationError,
  AmountExceedsTopLimitError,
  PendingPolicyExceptionsError,
  RejectionReasonRequiredError,
  ReassignmentTargetInvalidError,
} from "~/contexts/approvals/domain/errors.js";

// ── Composition root (default deps) ───────────────────────────────────────
import { PrismaApprovalInboxQueries } from "~/contexts/approvals/infrastructure/PrismaApprovalInboxQueries.js";
import { PrismaAuthorizerRepository } from "~/contexts/approvals/infrastructure/PrismaAuthorizerRepository.js";
import {
  WorkflowRulesAdapter,
  LegacyPolicyExceptionAdapter,
  LegacyAnticipoPolizaAdapter,
  LegacyEmployeeHierarchyAdapter,
} from "~/contexts/approvals/infrastructure/legacyAdapters.js";

import * as getApprovalInboxModule from "~/contexts/approvals/application/getApprovalInbox.js";
import * as authorizeModule from "~/contexts/approvals/application/authorizeTravelRequest.js";
import * as rejectModule from "~/contexts/approvals/application/rejectTravelRequest.js";
import * as reassignModule from "~/contexts/approvals/application/reassignApproval.js";

const defaultInboxQueries = new PrismaApprovalInboxQueries();
const defaultAuthorizerRepo = new PrismaAuthorizerRepository();
const defaultWorkflowRules = new WorkflowRulesAdapter();
const defaultPolicyExceptions = new LegacyPolicyExceptionAdapter();
const defaultAnticipoPoliza = new LegacyAnticipoPolizaAdapter();
const defaultEmployeeHierarchy = new LegacyEmployeeHierarchyAdapter();

// ── Use-cases pre-wired ──────────────────────────────────────────────────

export const getApprovalInbox = (
  actorUserId: number,
  statusId: 2 | 3,
  opts: import("~/contexts/approvals/domain/ports/ApprovalInboxQueries.js").ApprovalInboxQueryOpts = {},
) =>
  getApprovalInboxModule.getApprovalInbox(actorUserId, statusId, opts, {
    inboxQueries: defaultInboxQueries,
  });

export const authorizeTravelRequest = (input: authorizeModule.AuthorizeTravelRequestInput) =>
  authorizeModule.authorizeTravelRequest(input, {
    authorizerRepo: defaultAuthorizerRepo,
    workflowRules: defaultWorkflowRules,
    policyExceptions: defaultPolicyExceptions,
    anticipoPoliza: defaultAnticipoPoliza,
    employeeHierarchy: defaultEmployeeHierarchy,
  });

export const rejectTravelRequest = (input: rejectModule.RejectTravelRequestInput) =>
  rejectModule.rejectTravelRequest(input, {
    authorizerRepo: defaultAuthorizerRepo,
    employeeHierarchy: defaultEmployeeHierarchy,
  });

export const reassignApproval = (input: reassignModule.ReassignApprovalInput) =>
  reassignModule.reassignApproval(input, { authorizerRepo: defaultAuthorizerRepo });

/** Excepciones de política (delegado al slice policies via port). */
export const decideException = (
  exceptionId: number,
  decision: "APPROVED" | "REJECTED",
  userId: number,
  note: string | null,
) => defaultPolicyExceptions.decideException(exceptionId, decision, userId, note);

// ── Sub-features convertidas a TS en sesión E ──────────────────────────
export { resolveN1N2Approvers } from "~/contexts/approvals/application/approverResolver.js";
export {
  upsertSubstitute,
  listSubstitutes,
  removeSubstitute,
  createSubstitute,
  deleteSubstitute,
  processStaleApprovals,
  ApprovalSubstituteError,
} from "~/contexts/approvals/application/approvalSubstituteService.js";
export {
  findAlertMessageIdForRequestStatus,
  REQUEST_STATUS_ALERT_TEXT,
} from "~/contexts/approvals/application/alertMessageResolver.js";
export { createRequestInsertAlert } from "~/contexts/approvals/application/createRequestInsertAlert.js";

// ── Raw use-cases (para tests + composiciones custom) ────────────────────
export const usecases = {
  getApprovalInbox: getApprovalInboxModule.getApprovalInbox,
  authorizeTravelRequest: authorizeModule.authorizeTravelRequest,
  rejectTravelRequest: rejectModule.rejectTravelRequest,
  reassignApproval: reassignModule.reassignApproval,
} as const;

export const adapters = {
  ApprovalInboxQueries: PrismaApprovalInboxQueries,
  AuthorizerRepository: PrismaAuthorizerRepository,
  WorkflowRulesPort: WorkflowRulesAdapter,
  PolicyExceptionPort: LegacyPolicyExceptionAdapter,
  AnticipoPolizaPort: LegacyAnticipoPolizaAdapter,
  EmployeeHierarchyPort: LegacyEmployeeHierarchyAdapter,
} as const;
