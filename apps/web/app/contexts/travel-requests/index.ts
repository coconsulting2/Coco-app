/**
 * @module travel-requests (slice public API)
 * @description Convertido a TS en sesión E — cero `@ts-ignore` aquí.
 */

// ── Domain types ──────────────────────────────────────────────────────────
export type {
  RequestId,
  UserId,
  RequestStatus,
  RouteLeg,
  TravelRequestSummary,
  TravelRequestDetail,
  CreateTravelRequestInput,
  EditTravelRequestInput,
} from "~/contexts/travel-requests/domain/entities/Request.js";

export type { RequestRepository } from "~/contexts/travel-requests/domain/ports/RequestRepository.js";
export type {
  TravelRequestAdminQueries,
  TravelRequestDetailRow,
  TravelRequestSummaryByDept,
} from "~/contexts/travel-requests/domain/ports/TravelRequestAdminQueries.js";

export {
  TravelRequestError,
  RequestNotFoundError,
  InvalidStatusTransitionError,
  RequestNotCancellableError,
  DuplicateCfdiError,
  ViaticasPolicyExceededError,
  InvalidTravelRequestInputError,
} from "~/contexts/travel-requests/domain/errors.js";

export type {
  TravelRequestCreator,
  CreatedTravelRequest,
} from "~/contexts/travel-requests/domain/ports/TravelRequestCreator.js";
export type {
  ViaticasPolicyChecker,
  ViaticasPolicyCheckInput,
} from "~/contexts/travel-requests/domain/ports/ViaticasPolicyChecker.js";

// ── Use-cases TS (sesión E) ──────────────────────────────────────────────
export {
  listCompletedRequests,
  listActiveRequests,
  listDrafts,
  getRequestDetail,
  getCostCenterForUser,
} from "~/contexts/travel-requests/application/applicantQueryService.js";

export {
  formatRoutes,
  getRequestDays,
  cancelTravelRequestValidation,
  createExpenseValidationBatch,
  sendReceiptsForValidation,
  getCountryId,
  getCityId,
  TravelRequestServiceError,
  type RouteInput,
  type ReceiptInput,
} from "~/contexts/travel-requests/application/applicantService.js";

export {
  buildSolicitudJourney,
  buildJourneyStepDefinitions,
  approvalLevelsFromSnapshot,
  routeNeedsAgency,
  type StepState,
  type JourneyStep,
  type JourneyStepDef,
  type HistorialEntry,
  type JourneyOutput,
} from "~/contexts/travel-requests/application/solicitudJourneyService.js";

export {
  requestAllowsReceiptUpload,
  assertRequestAllowsReceiptUpload,
  ReceiptUploadPolicyError,
  MIN_STATUS_FOR_RECEIPT_UPLOAD,
  MAX_STATUS_FOR_RECEIPT_UPLOAD,
} from "~/contexts/travel-requests/application/requestReceiptUploadPolicy.js";

// ── Transport DTO → domain input mappers (TravelRequestForm body) ────────
export {
  toCreateTravelRequestInput,
  toEditTravelRequestInput,
  toCreateDraftPartial,
  type SubmittedTravelBody,
} from "~/contexts/travel-requests/application/travelRequestFormBody.js";

// ── Normalizers puros (form input + display view-model) ─────────────────
export {
  normalizeRequestDetailForForm,
  normalizeRequestDetailForDisplay,
  type RequestDetailFormInput,
  type RouteFormInput,
  type RequestDetailDisplay,
} from "~/contexts/travel-requests/application/normalizeRequestDetailForForm.js";

// ── Hexagonal queries (admin views) ───────────────────────────────────────
import { PrismaTravelRequestAdminQueries } from "~/contexts/travel-requests/infrastructure/PrismaTravelRequestAdminQueries.js";
import * as detailModule from "~/contexts/travel-requests/application/getTravelRequestDetail.js";
import * as listByStatusModule from "~/contexts/travel-requests/application/listTravelRequestsByStatus.js";

const defaultAdminQueries = new PrismaTravelRequestAdminQueries();

export const getTravelRequestDetail = (requestId: number) =>
  detailModule.getTravelRequestDetail(requestId, { queries: defaultAdminQueries });

export const listTravelRequestsByDeptStatus = (
  deptId: number,
  statusId: number,
  limit: number | null = null,
) =>
  detailModule.listTravelRequestsByDeptStatus(deptId, statusId, limit, {
    queries: defaultAdminQueries,
  });

export const listTravelRequestsByStatusIds = (
  input: listByStatusModule.ListByStatusIdsInput,
) => listByStatusModule.listByStatusIds(input, { queries: defaultAdminQueries });

export const listTravelRequestsByUserAndStatusIds = (
  input: listByStatusModule.ListByUserAndStatusIdsInput,
) =>
  listByStatusModule.listByUserAndStatusIds(input, { queries: defaultAdminQueries });

export type {
  ListByStatusIdsInput,
  ListByUserAndStatusIdsInput,
} from "~/contexts/travel-requests/application/listTravelRequestsByStatus.js";

// ── Hexagonal write use-case: createTravelRequest ────────────────────────
import type { CreateTravelRequestInput } from "~/contexts/travel-requests/domain/entities/Request.js";
import { PrismaTravelRequestCreator } from "~/contexts/travel-requests/infrastructure/PrismaTravelRequestCreator.js";
import { PoliciesViaticasPolicyChecker } from "~/contexts/travel-requests/infrastructure/PoliciesViaticasPolicyChecker.js";
import * as createTravelRequestModule from "~/contexts/travel-requests/application/createTravelRequest.js";

const defaultCreator = new PrismaTravelRequestCreator();
const defaultPolicyChecker = new PoliciesViaticasPolicyChecker();

export const createTravelRequest = (
  input: CreateTravelRequestInput,
) =>
  createTravelRequestModule.createTravelRequest(input, {
    policy: defaultPolicyChecker,
    creator: defaultCreator,
  });

export type {
  CreateTravelRequestDeps,
  CreateTravelRequestResult,
} from "~/contexts/travel-requests/application/createTravelRequest.js";

// ── Hexagonal query use-case: getSolicitudJourney (timeline) ─────────────
export type {
  RequestJourneyQueries,
  RequestJourneyData,
  JourneyHistorialEntry,
} from "~/contexts/travel-requests/domain/ports/RequestJourneyQueries.js";
import { PrismaRequestJourneyQueries } from "~/contexts/travel-requests/infrastructure/PrismaRequestJourneyQueries.js";
import * as getSolicitudJourneyModule from "~/contexts/travel-requests/application/getSolicitudJourney.js";

const defaultJourneyQueries = new PrismaRequestJourneyQueries();

export const getSolicitudJourney = (
  input: getSolicitudJourneyModule.GetSolicitudJourneyInput,
) =>
  getSolicitudJourneyModule.getSolicitudJourney(input, {
    journey: defaultJourneyQueries,
  });

export type {
  GetSolicitudJourneyInput,
  GetSolicitudJourneyDeps,
} from "~/contexts/travel-requests/application/getSolicitudJourney.js";

// ── Hexagonal write use-case: submitReceiptsForValidation (6 → 7) ────────
export type { ReceiptValidationSubmission } from "~/contexts/travel-requests/domain/ports/ReceiptValidationSubmission.js";
import { PrismaReceiptValidationSubmission } from "~/contexts/travel-requests/infrastructure/PrismaReceiptValidationSubmission.js";
import * as submitReceiptsForValidationModule from "~/contexts/travel-requests/application/submitReceiptsForValidation.js";

const defaultReceiptValidationSubmission = new PrismaReceiptValidationSubmission();

export const submitReceiptsForValidation = (
  input: submitReceiptsForValidationModule.SubmitReceiptsForValidationInput,
) =>
  submitReceiptsForValidationModule.submitReceiptsForValidation(input, {
    submission: defaultReceiptValidationSubmission,
  });

export type {
  SubmitReceiptsForValidationInput,
  SubmitReceiptsForValidationResult,
} from "~/contexts/travel-requests/application/submitReceiptsForValidation.js";

// ── Hexagonal write use-cases: edit / draft / confirm / cancel ───────────
export type { TravelRequestEditor } from "~/contexts/travel-requests/domain/ports/TravelRequestEditor.js";
export type { TravelRequestDraftWriter } from "~/contexts/travel-requests/domain/ports/TravelRequestDraftWriter.js";
export type { TravelRequestCanceller } from "~/contexts/travel-requests/domain/ports/TravelRequestCanceller.js";
import { PrismaTravelRequestEditor } from "~/contexts/travel-requests/infrastructure/PrismaTravelRequestEditor.js";
import { PrismaTravelRequestDraftWriter } from "~/contexts/travel-requests/infrastructure/PrismaTravelRequestDraftWriter.js";
import { PrismaTravelRequestCanceller } from "~/contexts/travel-requests/infrastructure/PrismaTravelRequestCanceller.js";
import * as editTravelRequestModule from "~/contexts/travel-requests/application/editTravelRequest.js";
import * as draftTravelRequestModule from "~/contexts/travel-requests/application/draftTravelRequest.js";
import * as cancelTravelRequestModule from "~/contexts/travel-requests/application/cancelTravelRequest.js";

const defaultEditor = new PrismaTravelRequestEditor();
const defaultDraftWriter = new PrismaTravelRequestDraftWriter();
const defaultCanceller = new PrismaTravelRequestCanceller();

export const editTravelRequest = (
  input: import("~/contexts/travel-requests/domain/entities/Request.js").EditTravelRequestInput,
) => editTravelRequestModule.editTravelRequest(input, { editor: defaultEditor });

export const createDraftTravelRequest = (
  userId: number,
  partial: Partial<CreateTravelRequestInput>,
) =>
  draftTravelRequestModule.createDraftTravelRequest(userId, partial, {
    draftWriter: defaultDraftWriter,
  });

export const confirmDraftTravelRequest = (userId: number, requestId: number) =>
  draftTravelRequestModule.confirmDraftTravelRequest(userId, requestId, {
    draftWriter: defaultDraftWriter,
  });

export const cancelTravelRequest = (
  input: cancelTravelRequestModule.CancelTravelRequestInput,
) =>
  cancelTravelRequestModule.cancelTravelRequest(input, {
    canceller: defaultCanceller,
  });

export type {
  EditTravelRequestDeps,
} from "~/contexts/travel-requests/application/editTravelRequest.js";
export type {
  DraftTravelRequestDeps,
} from "~/contexts/travel-requests/application/draftTravelRequest.js";
export type {
  CancelTravelRequestInput,
  CancelTravelRequestResult,
} from "~/contexts/travel-requests/application/cancelTravelRequest.js";

export const usecases = {
  getTravelRequestDetail: detailModule.getTravelRequestDetail,
  listTravelRequestsByDeptStatus: detailModule.listTravelRequestsByDeptStatus,
  createTravelRequest: createTravelRequestModule.createTravelRequest,
  getSolicitudJourney: getSolicitudJourneyModule.getSolicitudJourney,
  submitReceiptsForValidation: submitReceiptsForValidationModule.submitReceiptsForValidation,
  editTravelRequest: editTravelRequestModule.editTravelRequest,
  createDraftTravelRequest: draftTravelRequestModule.createDraftTravelRequest,
  confirmDraftTravelRequest: draftTravelRequestModule.confirmDraftTravelRequest,
  cancelTravelRequest: cancelTravelRequestModule.cancelTravelRequest,
} as const;

export const adapters = {
  TravelRequestAdminQueries: PrismaTravelRequestAdminQueries,
  TravelRequestCreator: PrismaTravelRequestCreator,
  ViaticasPolicyChecker: PoliciesViaticasPolicyChecker,
  RequestJourneyQueries: PrismaRequestJourneyQueries,
  ReceiptValidationSubmission: PrismaReceiptValidationSubmission,
  TravelRequestEditor: PrismaTravelRequestEditor,
  TravelRequestDraftWriter: PrismaTravelRequestDraftWriter,
  TravelRequestCanceller: PrismaTravelRequestCanceller,
} as const;
