/**
 * @module importRoleResolution
 * @description Resuelve el rol destino mezclando: alias internos, mapa embebido en el JSON
 *   y (en apply) el mapa enviado desde el front para etiquetas de otras empresas.
 */
import { resolveCanonicalRoleName } from "~/contexts/onboarding/application/roleAliasResolver";

/**
 * @param rawRole Texto del archivo (ej. "Approver", "cxp").
 * @param validRoleNames Roles existentes en la org.
 * @param fileMappings roleMappings del JSON raíz (opcional).
 */
export function resolveImportRole(
  rawRole: string,
  validRoleNames: string[],
  fileMappings: Record<string, string> = {},
): { mappedRoleName: string | null; externalRoleLabel: string | null } {
  const raw = String(rawRole ?? "").trim();
  if (!raw) return { mappedRoleName: null, externalRoleLabel: null };

  const lowerValid = new Map(validRoleNames.map((n) => [n.toLowerCase(), n]));

  let resolved = resolveCanonicalRoleName(raw, validRoleNames);
  let canonical = lowerValid.get(resolved.toLowerCase());
  if (canonical) return { mappedRoleName: canonical, externalRoleLabel: null };

  let targetFromFile: string | null = null;
  for (const [key, val] of Object.entries(fileMappings)) {
    if (String(key).trim().toLowerCase() === raw.toLowerCase()) {
      targetFromFile = String(val ?? "").trim();
      break;
    }
  }

  if (targetFromFile) {
    resolved = resolveCanonicalRoleName(targetFromFile, validRoleNames);
    canonical = lowerValid.get(resolved.toLowerCase());
    if (canonical) return { mappedRoleName: canonical, externalRoleLabel: null };

    canonical = lowerValid.get(targetFromFile.toLowerCase());
    if (canonical) return { mappedRoleName: canonical, externalRoleLabel: null };
  }

  return { mappedRoleName: null, externalRoleLabel: raw };
}

/**
 * Normaliza el nombre de rol elegido en UI contra el catálogo de la org.
 * @returns Nombre canónico en la org o null.
 */
export function resolveManualRoleMapping(
  pickedRoleName: string | null | undefined,
  validRoleNames: string[],
): string | null {
  const raw = String(pickedRoleName ?? "").trim();
  if (!raw) return null;

  const lowerValid = new Map(validRoleNames.map((n) => [n.toLowerCase(), n]));

  const resolved = resolveCanonicalRoleName(raw, validRoleNames);
  let canonical = lowerValid.get(resolved.toLowerCase());
  if (canonical) return canonical;

  canonical = lowerValid.get(raw.toLowerCase());
  return canonical ?? null;
}
