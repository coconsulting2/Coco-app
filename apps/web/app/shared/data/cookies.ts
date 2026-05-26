// import type { UserRole } from "~/shared/types/roles";

// const mockCookies = {
//     username: "John Doe",
//     id: "1",
//     department_id: "1",
//     role: "Applicant" as UserRole //'Applicant' | 'Authorizer' | 'Admin' | 'AccountsPayable' | 'TravelAgency';
// };

// export const getCookie = (key: keyof typeof mockCookies): string | UserRole => {
//     return mockCookies[key];
// };

import type { UserRole } from "~/shared/types/roles";

// RR v7 reemplaza Astro.cookies. Aceptamos cualquier objeto con get(name) → { value }
// (Astro), o get(name) → string (otros adapters). Compatibilidad mínima.
type CookieJar = { get(name: string): { value: string } | string | null | undefined };
type APIContext = { cookies: CookieJar };

export type Session = {
  username: string;
  id: string;
  role: UserRole;
  department_id?: string;
  token: string;
  permissions?: string[];
};

function emptySession(): Session {
  return {
    username: "",
    id: "",
    department_id: "",
    role: "" as UserRole,
    token: "",
  };
}

/**
 * Lee una cookie del documento (solo navegador). LoginForm escribe `token`, `role`, etc.
 * para que apiRequest y fetch desde islas React puedan enviar Authorization Bearer.
 */
function readCookieFromDocument(name: string): string {
  if (typeof document === "undefined") return "";
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1].trim()) : "";
}

function getSessionFromBrowser(): Session {
  return {
    username: readCookieFromDocument("username"),
    id: readCookieFromDocument("user_id") || readCookieFromDocument("id"),
    department_id: readCookieFromDocument("department_id"),
    role: readCookieFromDocument("role") as UserRole,
    token: readCookieFromDocument("token"),
  };
}

function readCookieJar(jar: CookieJar, name: string): string {
  const raw = jar.get(name);
  if (raw == null) return "";
  if (typeof raw === "string") return raw;
  return (raw as { value: string }).value ?? "";
}

function getSessionFromAstro(realCookies: APIContext["cookies"]): Session {
  return {
    username: readCookieJar(realCookies, "username"),
    id:
      readCookieJar(realCookies, "id") ||
      readCookieJar(realCookies, "user_id"),
    department_id: readCookieJar(realCookies, "department_id"),
    role: readCookieJar(realCookies, "role") as UserRole,
    token: readCookieJar(realCookies, "token"),
  };
}

export function getSession(cookies?: APIContext["cookies"]): Session {
  if (cookies) {
    return getSessionFromAstro(cookies);
  }
  // En el navegador leemos del document; en SSR el caller debe pasar `cookies`
  // explícitamente (RR v7 no expone un jar global). Sin ellas → sesión vacía.
  if (typeof globalThis.window !== "undefined") {
    return getSessionFromBrowser();
  }
  return emptySession();
}

type CookieKey = Exclude<keyof Session, "permissions">;

export function getCookie(key: CookieKey, cookies?: APIContext["cookies"]): string {
  return getSession(cookies)[key] ?? "";
}

const SESSION_COOKIE_NAMES = [
  "token",
  "role",
  "username",
  "user_id",
  "id",
  "department_id",
  "no_empleado",
] as const;

/** Borra cookies de sesión en el dominio del frontend (tras logout en API). */
export function clearSessionCookies(): void {
  if (typeof document === "undefined") return;
  const expires = "Thu, 01 Jan 1970 00:00:00 GMT";
  for (const name of SESSION_COOKIE_NAMES) {
    document.cookie = `${name}=; path=/; expires=${expires}; SameSite=Strict`;
    document.cookie = `${name}=; path=/; expires=${expires}; SameSite=Strict; Secure`;
  }
}
