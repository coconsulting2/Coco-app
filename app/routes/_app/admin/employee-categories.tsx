/**
 * @module employee-categories
 * @description Página migrada del legacy. Loader pide permiso y (si aplica)
 * carga el dato inicial via DI. Renderiza un componente legacy si existe en
 * shared/ui; si no, muestra placeholder marcado como migration target.
 */
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import { requirePermissions, runInTenant } from "~/platform/session/requireUser.server";
import EmployeeCategoriesAdmin from "~/shared/ui/EmployeeCategoriesAdmin";


export function meta() {
  return [{ title: "Categorías de empleado — CocoConsulting" }];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requirePermissions(request, "policy:manage");
  return { ok: true };
}

export default function PageRoute() {
  const data = useLoaderData() as Awaited<ReturnType<typeof loader>>;

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">Coco / Admin / Categorías</p>
        <h1 className="font-serif text-3xl md:text-4xl">Categorías de empleado</h1>
      </header>
      <EmployeeCategoriesAdmin />
    </section>
  );
}
