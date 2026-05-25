/**
 * @module OnboardingImportService
 * @description Puerto driven del slice: superficie de orquestación del import
 * (preview + apply). El use-case `runOnboardingImport` depende de esta
 * abstracción; el adapter concreto vive en `application/onboardingImportService.ts`.
 */
import type {
  ApplyImportResult,
  CustomImportRoleSpec,
  PreviewImportResult,
} from "~/contexts/onboarding/domain/entities/ImportUser";

/** Opciones de la fase preview. */
export type PreviewImportOptions = {
  createNewOrganization?: boolean;
  actorHasOrganizationCreate?: boolean;
};

/** Opciones de la fase apply. */
export type ApplyImportOptions = {
  roleMappings?: Record<string, string>;
  roleOverrides?: Record<string, string>;
  permissionExtras?: Record<string, string[]>;
  passwordGlobal?: string;
  passwordOverrides?: Record<string, string>;
  customImportRoles?: Record<string, CustomImportRoleSpec>;
  createNewOrganization?: boolean;
};

export interface OnboardingImportService {
  previewImport(
    buffer: Buffer,
    mimetype: string,
    originalname: string,
    organizationId: bigint | number | string,
    actingUserId: bigint | number | string,
    options?: PreviewImportOptions,
  ): Promise<PreviewImportResult>;

  applyImport(
    previewToken: string,
    organizationId: bigint | number | string,
    actingUserId: bigint | number | string,
    options?: ApplyImportOptions,
  ): Promise<ApplyImportResult>;
}
