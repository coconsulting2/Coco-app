/**
 * @module onboardingImportServiceAdapter
 * @description Adapter que implementa el port `OnboardingImportService` sobre
 * las funciones `previewImport`/`applyImport` del orquestador. Traduce el
 * shape de opciones del port (objeto) a los argumentos posicionales del
 * servicio legacy, manteniendo paridad 1:1 con el controller.
 */
import {
  previewImport,
  applyImport,
} from "~/contexts/onboarding/application/onboardingImportService.js";
import type {
  ApplyImportResult,
  PreviewImportResult,
} from "~/contexts/onboarding/domain/entities/ImportUser";
import type {
  ApplyImportOptions,
  OnboardingImportService,
  PreviewImportOptions,
} from "~/contexts/onboarding/domain/ports/OnboardingImportService";

export const onboardingImportServiceAdapter: OnboardingImportService = {
  previewImport(
    buffer: Buffer,
    mimetype: string,
    originalname: string,
    organizationId: bigint | number | string,
    actingUserId: bigint | number | string,
    options: PreviewImportOptions = {},
  ): Promise<PreviewImportResult> {
    return previewImport(buffer, mimetype, originalname, organizationId, actingUserId, options);
  },

  applyImport(
    previewToken: string,
    organizationId: bigint | number | string,
    actingUserId: bigint | number | string,
    options: ApplyImportOptions = {},
  ): Promise<ApplyImportResult> {
    return applyImport(
      previewToken,
      organizationId,
      actingUserId,
      options.roleMappings ?? {},
      options.permissionExtras ?? {},
      {
        globalPassword: options.passwordGlobal,
        perUser: options.passwordOverrides,
      },
      options.roleOverrides ?? {},
      { createNewOrganization: options.createNewOrganization },
      options.customImportRoles ?? {},
    );
  },
};
