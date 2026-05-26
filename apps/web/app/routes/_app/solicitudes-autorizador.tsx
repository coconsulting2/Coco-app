/**
 * @module solicitudes-autorizador
 * @description Histórico de decisiones del aprobador (N1/N2): las solicitudes
 * que ÉL ya aprobó / rechazó / reasignó / escaló. NO es la bandeja de
 * pendientes (eso vive en `autorizaciones`). Loader-driven vía el use-case hex
 * `listApproverDecisionHistory` del slice approvals; render prop-driven con
 * `ApproverDecisionHistoryList`.
 */
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import { requirePermissions, runInTenant } from "~/platform/session/requireUser.server";
import { listApproverDecisionHistory } from "~/contexts/approvals";
import ApproverDecisionHistoryList from "~/shared/ui/RequestsLists/ApproverDecisionHistoryList";
import type { ApproverDecisionRow } from "~/shared/ui/RequestsLists/ApproverDecisionHistoryList";
import type { UserRole } from "~/shared/types/roles";

export function meta() {
  return [{ title: "Mis decisiones — CocoConsulting" }];
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requirePermissions(request, "travel_request:authorize");
  const role = session.user.role as UserRole;

  const history = await runInTenant(session, async () =>
    listApproverDecisionHistory(session.user.user_id, {
      organizationId: session.user.organization_id,
      n: null,
    }),
  );

  const rows: ApproverDecisionRow[] = history.map((h) => ({
    request_id: h.requestId,
    action: h.action,
    decided_at: toIso(h.decidedAt),
    request_status: h.requestStatus,
    requester_name: h.requesterName,
    destination_country: h.destinationCountry,
    beginning_date: toIso(h.beginningDate),
    ending_date: toIso(h.endingDate),
    comentario: h.comentario,
  }));

  return { role, rows };
}

export default function PageRoute() {
  const { role, rows } = useLoaderData() as Awaited<ReturnType<typeof loader>>;

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">
          Coco / Mis decisiones
        </p>
        <h1 className="font-serif text-3xl md:text-4xl">Mis decisiones</h1>
        <p className="text-sm text-[var(--color-ink-muted)]">
          Historial de solicitudes que ya resolviste como {role}.
        </p>
      </header>
      <ApproverDecisionHistoryList rows={rows} />
    </section>
  );
}
