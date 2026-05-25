/**
 * @module aprobaciones
 * @description Alias del legacy de `/autorizaciones` (mismo loader y misma
 * vista). Legacy `aprobaciones.astro` literalmente hacía
 * `Astro.redirect("/autorizaciones")` — aquí mantenemos la URL viva con
 * la misma data para no romper enlaces internos.
 */
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import { requirePermissions, runInTenant } from "~/platform/session/requireUser.server";
import { getApprovalInbox } from "~/contexts/approvals";
import AuthRequestsList from "~/shared/ui/RequestsLists/AuthRequestsList";
import type { UserRole } from "~/shared/types/roles";

export function meta() {
  return [{ title: "Aprobaciones — CocoConsulting" }];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requirePermissions(request, "travel_request:authorize");
  const role = session.user.role as UserRole;
  const statusId: 2 | 3 = role === "N1" ? 2 : 3;

  const inbox = await runInTenant(session, async () =>
    getApprovalInbox(session.user.user_id, statusId, {
      organizationId: session.user.organization_id,
      n: null,
    }),
  );

  const rows = inbox.map((r) => ({
    request_id: r.requestId,
    request_status: r.requestStatus ?? null,
    requester_name: r.requesterName ?? null,
    department_name: r.departmentName ?? null,
    destination_country: r.destinationCountry,
    beginning_date: r.beginningDate,
    ending_date: r.endingDate,
  }));

  return { role, rows };
}

export default function PageRoute() {
  const { role, rows } = useLoaderData() as Awaited<ReturnType<typeof loader>>;

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">Coco / Aprobaciones</p>
        <h1 className="font-serif text-3xl md:text-4xl">Aprobaciones</h1>
        <p className="text-sm text-[var(--color-ink-muted)]">
          Bandeja de solicitudes pendientes ({role}).
        </p>
      </header>
      <AuthRequestsList data={rows} role={role} />
    </section>
  );
}
