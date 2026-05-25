/**
 * @module ImportStrategy
 * @description Puerto del slice. Cada estrategia concreta (CSV/JSON) parsea un
 * Buffer a `ParsedImportFile`. Los adapters viven en `application/strategies/`.
 */
import type { ParsedImportFile } from "~/contexts/onboarding/domain/entities/ImportUser";

export interface ImportStrategy {
  /** Tipos MIME que acepta esta estrategia. */
  readonly mimeTypes: string[];
  /** Nombre legible para logs/errores ("CSV" | "JSON"). */
  readonly label: string;
  /** Parsea el buffer del archivo a filas normalizadas + catálogos. */
  parse(buffer: Buffer): Promise<ParsedImportFile>;
}
