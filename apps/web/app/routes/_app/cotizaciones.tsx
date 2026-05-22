// @ts-nocheck — legacy route/view props mismatch; M11 UI follow-up
/**
 * @module cotizaciones
 * @description Página migrada del legacy. Loader pide permiso y (si aplica)
 * carga el dato inicial via DI. Renderiza un componente legacy si existe en
 * shared/ui; si no, muestra placeholder marcado como migration target.
 */
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import { requirePermissions, runInTenant } from "~/platform/session/requireUser.server";
import CxPAllRequestsList from "~/shared/ui/RequestsLists/CxPAllRequestsList";



export function meta() {
  return [{ title: "Cotizaciones — CocoConsulting" }];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requirePermissions(request, "accounts_payable:attend");
  return { ok: true };
}

export default function PageRoute() {
  const data = useLoaderData() as Awaited<ReturnType<typeof loader>>;

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">Coco / Cotizaciones</p>
        <h1 className="font-serif text-3xl md:text-4xl">Cotizaciones</h1>
      </header>
      <CxPAllRequestsList mode='quotes' />
    </section>
  );
}
