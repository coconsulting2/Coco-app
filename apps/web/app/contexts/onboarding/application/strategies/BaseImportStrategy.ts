/**
 * @module BaseImportStrategy
 * @description Clase base del patrón Strategy para parseo de archivos de onboarding.
 *
 * Cada estrategia concreta recibe el Buffer del archivo y devuelve un
 * `ParsedImportFile` con filas normalizadas. La validación de negocio se hace
 * en una capa superior (`onboardingImportValidationService`).
 */
import type { ImportStrategy } from "~/contexts/onboarding/domain/ports/ImportStrategy";
import type { ParsedImportFile } from "~/contexts/onboarding/domain/entities/ImportUser";

export abstract class BaseImportStrategy implements ImportStrategy {
  /** Tipos MIME que acepta esta estrategia. */
  abstract get mimeTypes(): string[];

  /** Nombre legible para logs/errores. */
  get label(): string {
    return this.constructor.name;
  }

  /** Parsea el buffer del archivo. */
  abstract parse(buffer: Buffer): Promise<ParsedImportFile>;
}
