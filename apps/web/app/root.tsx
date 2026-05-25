/**
 * @file app/root.tsx
 * @description HTML shell de toda la app. Incluye:
 *   - Tailwind v4 global.css (con @theme tokens editoriales).
 *   - Fuentes Google (Fraunces serif, Inter sans).
 *   - ErrorBoundary global con 404 / 500 fallback.
 *   - Root loader que resuelve el permission set efectivo del usuario (vía el
 *     service de plataforma, NO fetch client-side) e HIDRATA el
 *     `permissionStore` desde el cliente — reemplaza el viejo
 *     `apiRequest('/user/me/permissions')`.
 */
import { useEffect } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useRouteError,
} from "react-router";
import type { LinksFunction, LoaderFunctionArgs } from "react-router";

import "./shared/styles/global.css";

import { requireSession, runInTenant } from "~/platform/session/requireUser.server";
// `permission-service.server.js` está declarado en `types/legacy-js.d.ts`
// (platform legacy) — import directo sin `@ts-ignore`, mismo patrón que
// `routes/_app/_layout.tsx`. No es un model de slice: es infra de plataforma.
import { loadEffectivePermissions } from "~/platform/permissions/permission-service.server.js";
import { setPermissionCache, clearPermissionCache } from "~/shared/stores/permissionStore";
import type { PermissionCode } from "~/shared/types/permissions";

export const links: LinksFunction = () => [
  { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
  {
    rel: "preconnect",
    href: "https://fonts.googleapis.com",
  },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap",
  },
];

/**
 * Root loader: resuelve el permission set efectivo del usuario autenticado para
 * hidratar el `permissionStore` en el cliente. En rutas públicas (sin sesión)
 * devuelve `permissions: null` sin redirigir — `requireSession` lanzaría un
 * redirect a /login, que aquí capturamos y tratamos como "no autenticado" para
 * no romper /login ni la home pública.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const session = await requireSession(request);
    const permissions = (await runInTenant(session, async () =>
      loadEffectivePermissions(session.user.user_id),
    )) as PermissionCode[];
    return { permissions };
  } catch (err) {
    // requireSession redirige (Response 3xx) cuando no hay sesión válida:
    // en el root lo absorbemos para que las rutas públicas sigan funcionando.
    if (err instanceof Response) {
      return { permissions: null };
    }
    throw err;
  }
}

export type RootLoaderData = { permissions: PermissionCode[] | null };

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="bg-[var(--color-surface)] text-[var(--color-ink)] font-sans">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const data = useLoaderData() as RootLoaderData;

  // Hidrata el permissionStore client-side desde la data del loader, en vez de
  // que las islands hagan fetch a /api/user/me/permissions.
  useEffect(() => {
    if (data.permissions) {
      setPermissionCache(data.permissions);
    } else {
      clearPermissionCache();
    }
  }, [data.permissions]);

  return <Outlet />;
}

export function ErrorBoundary() {
  const error = useRouteError();
  let title = "Error";
  let message = "Ocurrió un problema inesperado.";
  let status = 500;

  if (isRouteErrorResponse(error)) {
    status = error.status;
    title = error.status === 404 ? "Página no encontrada" : `Error ${error.status}`;
    message = error.statusText || (typeof error.data === "string" ? error.data : message);
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-4">
        <p className="text-sm tracking-widest uppercase text-[var(--color-ink-muted)]">{status}</p>
        <h1 className="text-3xl font-serif">{title}</h1>
        <p className="text-[var(--color-ink-muted)]">{message}</p>
        <a
          href="/dashboard"
          className="inline-block mt-4 px-4 py-2 rounded-md bg-[var(--color-primary)] text-white"
        >
          Volver al inicio
        </a>
      </div>
    </main>
  );
}
