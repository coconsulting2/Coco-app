/**
 * @module 404
 * @description Página 404 servida cuando ninguna ruta calza. Equivalente a
 * pages/404.astro del frontend legacy. NO depende de auth.
 */
import { Link } from "react-router";

export function meta() {
  return [{ title: "Página no encontrada — CocoConsulting" }];
}

export default function NotFoundRoute() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-[var(--color-surface,#FAFAF7)]">
      <div className="max-w-md text-center space-y-4">
        <p className="text-sm tracking-widest uppercase text-[rgba(10,10,10,0.5)]">404</p>
        <h1 className="text-3xl font-serif">Página no encontrada</h1>
        <p className="text-[rgba(10,10,10,0.55)]">
          La página que buscas no existe o ya no está disponible.
        </p>
        <Link
          to="/dashboard"
          className="inline-block mt-4 px-4 py-2 rounded-md bg-[var(--color-primary-500,#3D4A2A)] text-white"
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
