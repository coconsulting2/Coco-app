/**
 * @module importStrategyResolver
 * @description Resuelve la estrategia de parseo correcta dado el MIME type o extensión
 *   del archivo subido. Parte del patrón Strategy: el caller desconoce el tipo concreto.
 */
import { JsonImportStrategy } from "~/contexts/onboarding/application/strategies/JsonImportStrategy";
import { CsvImportStrategy } from "~/contexts/onboarding/application/strategies/CsvImportStrategy";
import type { ImportStrategy } from "~/contexts/onboarding/domain/ports/ImportStrategy";

/** Estrategias registradas en orden de prioridad. */
const STRATEGIES: ImportStrategy[] = [new JsonImportStrategy(), new CsvImportStrategy()];

const EXT_MIME_MAP: Record<string, string> = {
  json: "application/json",
  csv: "text/csv",
  txt: "text/csv",
};

/**
 * Devuelve la estrategia adecuada para el tipo MIME o extensión del archivo.
 * @throws {Error} Si ninguna estrategia acepta el archivo.
 */
export function resolveImportStrategy(mimetype: string, originalname = ""): ImportStrategy {
  const ext = originalname.split(".").pop()?.toLowerCase() ?? "";

  const resolvedMime =
    mimetype === "application/octet-stream" && EXT_MIME_MAP[ext] ? EXT_MIME_MAP[ext] : mimetype;

  for (const strategy of STRATEGIES) {
    if (strategy.mimeTypes.includes(resolvedMime)) {
      return strategy;
    }
  }

  // Fallback por extensión si el MIME no matcheó.
  if (EXT_MIME_MAP[ext]) {
    const fallbackMime = EXT_MIME_MAP[ext];
    for (const strategy of STRATEGIES) {
      if (strategy.mimeTypes.includes(fallbackMime)) {
        return strategy;
      }
    }
  }

  const supported = STRATEGIES.flatMap((s) => s.mimeTypes).join(", ");
  throw new Error(
    `Tipo de archivo no soportado: "${mimetype}" (.${ext}). Tipos aceptados: ${supported}.`,
  );
}

/** Lista los tipos de archivo aceptados por todas las estrategias registradas. */
export function acceptedMimeTypes(): string[] {
  return STRATEGIES.flatMap((s) => s.mimeTypes);
}
