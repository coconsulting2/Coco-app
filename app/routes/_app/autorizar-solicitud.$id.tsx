/**
 * @module autorizar-solicitud.$id
 * @description Página migrada del legacy. Loader pide permiso y (si aplica)
 * carga el dato inicial via DI. Renderiza un componente legacy si existe en
 * shared/ui; si no, muestra placeholder marcado como migration target.
 */
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import { requirePermissions, runInTenant } from "~/platform/session/requireUser.server";
import TravelRequestAuthorizeActions from "~/shared/ui/TravelRequestAuthorizeActions";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — JS module
import { getRequestDetail } from "~/contexts/travel-requests/application/applicantQueryService.js";

export function meta() {
  return [{ title: "Autorizar solicitud — CocoConsulting" }];
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const session = await requirePermissions(request, "travel_request:authorize");
  const result = await runInTenant(session, async () => getRequestDetail(Number(params.id)));
  return { request: result };
}

export default function PageRoute({ params }: { params: { id?: string } }) {
  const data = useLoaderData() as Awaited<ReturnType<typeof loader>>;

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">Coco / Autorizar</p>
        <h1 className="font-serif text-3xl md:text-4xl">Autorizar solicitud</h1>
      </header>
      <TravelRequestAuthorizeActions requestId={Number(params.id)} request={data.request as any} />
    </section>
  );
}
