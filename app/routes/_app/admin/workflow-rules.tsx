/**
 * @module workflow-rules
 * @description Página migrada del legacy. Loader pide permiso y (si aplica)
 * carga el dato inicial via DI. Renderiza un componente legacy si existe en
 * shared/ui; si no, muestra placeholder marcado como migration target.
 */
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import { requirePermissions, runInTenant } from "~/platform/session/requireUser.server";
import WorkflowRulesAdmin from "~/shared/ui/admin/WorkflowRulesAdmin";



export function meta() {
  return [{ title: "Reglas de workflow — CocoConsulting" }];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requirePermissions(request, "workflow:manage");
  return { ok: true };
}

export default function PageRoute() {
  const data = useLoaderData() as Awaited<ReturnType<typeof loader>>;

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">Coco / Admin / Workflow</p>
        <h1 className="font-serif text-3xl md:text-4xl">Reglas de workflow</h1>
      </header>
      <WorkflowRulesAdmin />
    </section>
  );
}
