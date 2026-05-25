/**
 * In-memory + sessionStorage cache del set de permisos efectivo del usuario
 * autenticado. La fuente de verdad es el loader RR7 (root/`_app/_layout`), que
 * resuelve los permisos vía el use-case del slice identity y los HIDRATA aquí —
 * CERO fetch client-side a `/api/user/me/permissions`.
 *
 * Hidratación:
 *   - El root loader expone `permissions` en su data.
 *   - Un efecto cliente (o el provider que monta el layout) llama
 *     `setPermissionCache(permissions)` una vez por sesión.
 *
 * Uso en islands:
 *   const perms = getCachedPermissions();          // lee cache hidratada
 *   if (hasPermission(perms, "travel_request:authorize")) { ... }
 *
 * Llama `clearPermissionCache()` en logout.
 */
import type { PermissionCode } from "~/shared/types/permissions";

const STORAGE_KEY = "coco:permissions";

let cache: PermissionCode[] | null = null;

const readSessionStorage = (): PermissionCode[] | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const writeSessionStorage = (perms: PermissionCode[]): void => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(perms));
  } catch {
    /* storage full / disabled — cache stays in-memory */
  }
};

/** Hidrata ambos caches con el set de permisos resuelto por el loader. */
export const setPermissionCache = (perms: PermissionCode[]): void => {
  cache = perms;
  writeSessionStorage(perms);
};

/** Wipes both caches. Call from logout flows. */
export const clearPermissionCache = (): void => {
  cache = null;
  if (typeof window !== "undefined") {
    try { window.sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }
};

/**
 * Devuelve el set de permisos efectivo desde la cache (in-memory →
 * sessionStorage). NO hace fetch: si aún no fue hidratado por el loader,
 * devuelve `[]`. Los gates de servidor (`requirePermissions` en loaders/actions)
 * siguen siendo la autoridad real; esta cache es solo para UX client-side.
 */
export function getCachedPermissions(): PermissionCode[] {
  if (cache) return cache;
  const fromStorage = readSessionStorage();
  if (fromStorage) {
    cache = fromStorage;
    return cache;
  }
  return [];
}
