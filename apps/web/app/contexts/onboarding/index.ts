/**
 * @module index
 * @description API pública del slice onboarding (fachada + composition root).
 *
 * Patrón hexagonal:
 *   - Use-cases en `application/` reciben dependencias por parámetro (DI).
 *   - Adapters concretos en `application/`/`infrastructure/` implementan los ports.
 *   - Este index expone el use-case `runOnboardingImport` pre-wired con el
 *     adapter por default (lo que actions/loaders consumen) y re-exporta el
 *     use-case raw para que los tests inyecten stubs.
 */

// ── Domain types + errores ────────────────────────────────────────────────
export type { OnboardingImport } from "~/contexts/onboarding/domain/entities/OnboardingImport";
export type { OnboardingImportRepository } from "~/contexts/onboarding/domain/ports/OnboardingImportRepository";
export type { ImportStrategy } from "~/contexts/onboarding/domain/ports/ImportStrategy";
export type {
  OnboardingImportService,
  PreviewImportOptions,
  ApplyImportOptions,
} from "~/contexts/onboarding/domain/ports/OnboardingImportService";
export type {
  ApplyImportResult,
  ApplyImportFailure,
  CreatedImportUser,
  CustomImportRoleSpec,
  ImportConflict,
  ImportDepartment,
  ImportSociety,
  ImportUserDTO,
  ImportUserPreviewRow,
  ImportValidationError,
  OrganizationCreateSpec,
  PermissionsCatalog,
  PreviewImportResult,
  RoleCatalogEntry,
} from "~/contexts/onboarding/domain/entities/ImportUser";
export {
  OnboardingError,
  ImportNotFoundError,
  InvalidImportPayloadError,
  ImportRowError,
} from "~/contexts/onboarding/domain/errors";

// ── Use-case raw (para tests con stubs) ───────────────────────────────────
export {
  runOnboardingImport,
  type RunOnboardingImportCommand,
  type RunOnboardingImportResult,
  type RunOnboardingImportDeps,
  type PreviewOnboardingImportCommand,
  type ApplyOnboardingImportCommand,
} from "~/contexts/onboarding/application/runOnboardingImport.js";

// ── Composition root (default deps) ───────────────────────────────────────
import {
  runOnboardingImport as runOnboardingImportUseCase,
  type ApplyOnboardingImportCommand,
  type PreviewOnboardingImportCommand,
  type RunOnboardingImportResult,
} from "~/contexts/onboarding/application/runOnboardingImport.js";
import { onboardingImportServiceAdapter } from "~/contexts/onboarding/application/onboardingImportServiceAdapter.js";
import type { PreviewImportResult, ApplyImportResult } from "~/contexts/onboarding/domain/entities/ImportUser";

/** Previsualiza un import (parseo CSV/JSON + validación, sin persistir). */
export async function previewOnboardingImport(
  command: Omit<PreviewOnboardingImportCommand, "phase">,
): Promise<PreviewImportResult> {
  const out: RunOnboardingImportResult = await runOnboardingImportUseCase(
    { phase: "preview", ...command },
    { service: onboardingImportServiceAdapter },
  );
  if (out.phase !== "preview") throw new Error("Resultado inesperado del use-case (esperaba preview).");
  return out.preview;
}

/** Aplica un import previamente previsualizado (persiste usuarios). */
export async function applyOnboardingImport(
  command: Omit<ApplyOnboardingImportCommand, "phase">,
): Promise<ApplyImportResult> {
  const out: RunOnboardingImportResult = await runOnboardingImportUseCase(
    { phase: "apply", ...command },
    { service: onboardingImportServiceAdapter },
  );
  if (out.phase !== "apply") throw new Error("Resultado inesperado del use-case (esperaba apply).");
  return out.result;
}

// ── Catálogos (consumidos por loaders) ────────────────────────────────────
export { buildPermissionsCatalogGrouped } from "~/contexts/onboarding/application/permissionCatalog.js";

// ── Empleado sync + jerarquía (consumidos por otros slices) ───────────────
export { syncEmployee } from "~/contexts/onboarding/application/employeeSyncService.js";
export {
  getSubordinatesRecursive,
  wouldCreateManagerCycle,
  getApprovalChain,
  getHierarchyDepth,
} from "~/contexts/onboarding/application/employeeHierarchyService";
