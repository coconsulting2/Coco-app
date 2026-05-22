/**
 * @file app/root.tsx
 * @description HTML shell de toda la app. Incluye:
 *   - Tailwind v4 global.css (con @theme tokens editoriales).
 *   - Fuentes Google (Fraunces serif, Inter sans).
 *   - ErrorBoundary global con 404 / 500 fallback.
 */
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
} from "react-router";
import type { LinksFunction } from "react-router";

import "./shared/styles/global.css";

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
