/**
 * @module index
 * @description API pública del slice policies.
 */

export type { TravelPolicy } from "~/contexts/policies/domain/entities/TravelPolicy";
export type { PolicyRepository } from "~/contexts/policies/domain/ports/PolicyRepository";
export type { PolicyEngine } from "~/contexts/policies/domain/ports/PolicyEngine";
export { PoliciesError, PolicyNotFoundError, PolicyViolationError, InvalidPolicyCapsError } from "~/contexts/policies/domain/errors";

// @ts-ignore — JS module
export { listPolicies, createPolicy, updatePolicy, previewReceipt } from "~/contexts/policies/application/policyService.js";
// @ts-ignore — JS module
export { raisePolicyAlert } from "~/contexts/policies/application/policyAlertService.js";
// @ts-ignore — JS module
export { requestException, approveException, listExceptions } from "~/contexts/policies/application/policyExceptionService.js";
// @ts-ignore — JS module
export { getViaticosPolicy, setViaticosPolicy } from "~/contexts/policies/application/viaticasPolicyService.js";
// @ts-ignore — JS module
export { listCategories, createCategory, updateCategory } from "~/contexts/policies/application/employeeCategoryService.js";
