/**
 * @module runOnboardingImport
 * @description Use-case driver del import de onboarding. Recibe el servicio de
 * orquestación por DI (port `OnboardingImportService`) y dispatcha a la fase
 * `preview` (parseo + validación vía estrategias CSV/JSON) o `apply`
 * (persistencia). Es el punto único que consumen el dispatcher y las
 * actions/loaders RR7.
 */
import type {
  ApplyImportResult,
  PreviewImportResult,
} from "~/contexts/onboarding/domain/entities/ImportUser";
import type {
  ApplyImportOptions,
  OnboardingImportService,
  PreviewImportOptions,
} from "~/contexts/onboarding/domain/ports/OnboardingImportService";

export type RunOnboardingImportDeps = {
  service: OnboardingImportService;
};

/** Comando de previsualización: parsea el archivo (CSV/JSON) sin persistir. */
export type PreviewOnboardingImportCommand = {
  phase: "preview";
  /** Contenido binario del archivo subido. */
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  organizationId: bigint | number | string;
  actingUserId: bigint | number | string;
  options?: PreviewImportOptions;
};

/** Comando de aplicación: persiste los usuarios del preview. */
export type ApplyOnboardingImportCommand = {
  phase: "apply";
  previewToken: string;
  organizationId: bigint | number | string;
  actingUserId: bigint | number | string;
  options?: ApplyImportOptions;
};

export type RunOnboardingImportCommand =
  | PreviewOnboardingImportCommand
  | ApplyOnboardingImportCommand;

export type RunOnboardingImportResult =
  | { phase: "preview"; preview: PreviewImportResult }
  | { phase: "apply"; result: ApplyImportResult };

/**
 * Ejecuta una fase del import delegando en el servicio de orquestación.
 * Las estrategias CSV/JSON se resuelven dentro de `service.previewImport`.
 */
export async function runOnboardingImport(
  command: RunOnboardingImportCommand,
  deps: RunOnboardingImportDeps,
): Promise<RunOnboardingImportResult> {
  const { service } = deps;

  if (command.phase === "preview") {
    const preview = await service.previewImport(
      command.buffer,
      command.mimetype,
      command.originalname,
      command.organizationId,
      command.actingUserId,
      command.options,
    );
    return { phase: "preview", preview };
  }

  const result = await service.applyImport(
    command.previewToken,
    command.organizationId,
    command.actingUserId,
    command.options,
  );
  return { phase: "apply", result };
}
