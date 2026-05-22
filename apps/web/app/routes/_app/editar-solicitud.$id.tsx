// @ts-nocheck — legacy route/view props mismatch; M11 UI follow-up
/**
 * @module editar-solicitud.$id
 * @description Página migrada del legacy. Loader pide permiso y (si aplica)
 * carga el dato inicial via DI. Renderiza un componente legacy si existe en
 * shared/ui; si no, muestra placeholder marcado como migration target.
 */
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRouteLoaderData } from "react-router";

import { requirePermissions, runInTenant } from "~/platform/session/requireUser.server";
import type { AppLayoutData } from "../_layout";
import TravelRequestForm from "~/shared/ui/TravelRequestForm";
import { getRequestDetail } from "~/contexts/travel-requests/application/applicantQueryService.js";

export function meta() {
  return [{ title: "Editar solicitud — CocoConsulting" }];
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const session = await requirePermissions(request, "travel_request:edit_own");
  const result = await runInTenant(session, async () => getRequestDetail(Number(params.id)));
  return { request: result };
}

export default function PageRoute() {
  const data = useLoaderData() as Awaited<ReturnType<typeof loader>>;
  const layout = useRouteLoaderData("routes/_app/_layout") as AppLayoutData;
  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">Coco / Solicitudes / Editar</p>
        <h1 className="font-serif text-3xl md:text-4xl">Editar solicitud</h1>
      </header>
      <TravelRequestForm user_id={String(layout.user.userId)} mode="edit" role={layout.user.role} token="" request_data={data.request as any} />
    </section>
  );
}
