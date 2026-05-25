/**
 * @module solicitudes-autorizador
 * @description Vista del autorizador con las solicitudes que le competen.
 * Por paridad con el legacy (donde `solicitudes-autorizador.astro` montaba
 * `ApplicantView` — probable bug histórico), exponemos aquí la bandeja
 * de aprobación del autorizador (misma data que `autorizaciones`).
 * Si en Phase 2 se decide semántica distinta (histórico de decisiones,
 * etc.), refactor aquí.
 */
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import { requirePermissions, runInTenant } from "~/platform/session/requireUser.server";
import { getApprovalInbox } from "~/contexts/approvals";
import AuthRequestsList from "~/shared/ui/RequestsLists/AuthRequestsList";
import type { UserRole } from "~/shared/types/roles";

export function meta() {
  return [{ title: "Solicitudes — CocoConsulting" }];
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
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">Coco / Mis solicitudes</p>
        <h1 className="font-serif text-3xl md:text-4xl">Solicitudes asignadas</h1>
        <p className="text-sm text-[var(--color-ink-muted)]">
          Solicitudes que requieren tu autorización como {role}.
        </p>
      </header>
      <AuthRequestsList data={rows} role={role} />
    </section>
  );
}
