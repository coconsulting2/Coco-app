/**
 * @module index
 * @description API pública del slice approvals.
 */

export type { Approval } from "~/contexts/approvals/domain/entities/Approval";
export type { ApprovalRepository } from "~/contexts/approvals/domain/ports/ApprovalRepository";
export { ApprovalsError, ApprovalNotFoundError, AlreadyDecidedError, NotAuthorizedToApproveError } from "~/contexts/approvals/domain/errors";

// @ts-ignore — JS module
export { authorizeTravelRequest, rejectTravelRequest } from "~/contexts/approvals/application/authorizerService.js";
// @ts-ignore — JS module
export { resolveN1N2Approvers } from "~/contexts/approvals/application/approverResolver.js";
// @ts-ignore — JS module
export { upsertSubstitute, listSubstitutes, removeSubstitute } from "~/contexts/approvals/application/approvalSubstituteService.js";
