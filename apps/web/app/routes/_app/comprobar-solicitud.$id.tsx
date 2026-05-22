// @ts-nocheck — legacy route/view props mismatch; M11 UI follow-up
/**
 * @module comprobar-solicitud.$id
 * @description Página migrada del legacy. Loader pide permiso y (si aplica)
 * carga el dato inicial via DI. Renderiza un componente legacy si existe en
 * shared/ui; si no, muestra placeholder marcado como migration target.
 */
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import { requirePermissions, runInTenant } from "~/platform/session/requireUser.server";
import ValidateReceiptStatus from "~/shared/ui/ValidateReceiptStatus";


export function meta() {
  return [{ title: "Validar comprobantes — CocoConsulting" }];
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const session = await requirePermissions(request, "expense:submit");
  return { ok: true };
}

export default function PageRoute({ params }: { params: { id?: string } }) {
  const data = useLoaderData() as Awaited<ReturnType<typeof loader>>;

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">Coco / Solicitud</p>
        <h1 className="font-serif text-3xl md:text-4xl">Validar comprobantes</h1>
      </header>
      <ValidateReceiptStatus requestId={Number(params.id)} />
    </section>
  );
}
