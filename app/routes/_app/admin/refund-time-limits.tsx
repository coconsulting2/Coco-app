/**
 * @module refund-time-limits
 * @description Página migrada del legacy. Loader pide permiso y (si aplica)
 * carga el dato inicial via DI. Renderiza un componente legacy si existe en
 * shared/ui; si no, muestra placeholder marcado como migration target.
 */
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import { requirePermissions, runInTenant } from "~/platform/session/requireUser.server";
import RefundTimeLimitConfig from "~/shared/ui/RefundTimeLimitConfig";


export function meta() {
  return [{ title: "Plazo de reembolso — CocoConsulting" }];
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
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">Coco / Admin / Reembolsos</p>
        <h1 className="font-serif text-3xl md:text-4xl">Plazo de reembolso</h1>
      </header>
      <RefundTimeLimitConfig />
    </section>
  );
}
