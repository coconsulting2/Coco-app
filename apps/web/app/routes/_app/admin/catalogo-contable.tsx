/**
 * @module catalogo-contable
 * @description Página migrada del legacy. Loader pide permiso y (si aplica)
 * carga el dato inicial via DI. Renderiza un componente legacy si existe en
 * shared/ui; si no, muestra placeholder marcado como migration target.
 */
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import { requirePermissions, runInTenant } from "~/platform/session/requireUser.server";
import AccountingAccountAdmin from "~/shared/ui/AccountingAccountAdmin";


export function meta() {
  return [{ title: "Catálogo contable — CocoConsulting" }];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requirePermissions(request, "accounting:export");
  return { ok: true };
}

export default function PageRoute() {
  const data = useLoaderData() as Awaited<ReturnType<typeof loader>>;

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">Coco / Admin / Contabilidad</p>
        <h1 className="font-serif text-3xl md:text-4xl">Catálogo contable</h1>
      </header>
      <AccountingAccountAdmin />
    </section>
  );
}
