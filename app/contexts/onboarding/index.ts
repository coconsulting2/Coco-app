/**
 * @module index
 * @description API pública del slice onboarding.
 */

export type { OnboardingImport } from "~/contexts/onboarding/domain/entities/OnboardingImport";
export type { OnboardingImportRepository } from "~/contexts/onboarding/domain/ports/OnboardingImportRepository";
export type { ImportStrategy } from "~/contexts/onboarding/domain/ports/ImportStrategy";
export { OnboardingError, ImportNotFoundError, InvalidImportPayloadError, ImportRowError } from "~/contexts/onboarding/domain/errors";

// @ts-ignore — JS module
export { syncEmployee } from "~/contexts/onboarding/application/employeeSyncService.js";
// @ts-ignore — JS module
export { getSubordinatesRecursive, wouldCreateManagerCycle } from "~/contexts/onboarding/application/employeeHierarchyService.js";
