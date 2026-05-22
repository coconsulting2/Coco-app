/**
 * @module historial
 * @description Historial de solicitudes (completadas) del solicitante. Loader
 * llama directamente a `Applicant.getCompletedRequests(userId)` por DI —
 * sin fetch HTTP, sin `/api/applicant/get-completed-requests/:user_id`.
 *
 * El backend legacy expone ese endpoint solo para integraciones externas o
 * cypress; para uso in-app, este patrón evita el roundtrip.
 */
import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";

import { requireAnyPermission, runInTenant } from "~/platform/session/requireUser.server";
import { listCompletedRequests } from "~/contexts/travel-requests/application/applicantQueryService.js";

export function meta() {
  return [{ title: "Historial de viajes — CocoConsulting" }];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requireAnyPermission(request, "travel_request:create", "travel_request:view_any");
  const requests = await runInTenant(session, async () =>
    listCompletedRequests(session.user.user_id),
  );
  return { requests: Array.isArray(requests) ? requests : [] };
}

type RequestRow = {
  request_id: number;
  status?: string;
  destination_country?: string | null;
  beginning_date?: string | Date | null;
  ending_date?: string | Date | null;
};

export default function HistorialRoute() {
  const { requests } = useLoaderData() as { requests: RequestRow[] };

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">
          Coco / Historial
        </p>
        <h1 className="font-serif text-3xl md:text-4xl">Historial de viajes</h1>
        <p className="text-[var(--color-ink-muted)]">
          Solicitudes completadas y archivadas.
        </p>
      </header>

      {requests.length === 0 ? (
        <article className="text-center py-16 border border-dashed border-[var(--color-neutral-200)] rounded-lg">
          <p className="text-[var(--color-ink-muted)]">Sin viajes en tu historial.</p>
          <Link
            to="/crear-solicitud"
            className="inline-block mt-4 px-4 py-2 rounded-md bg-[var(--color-primary-500,#3D4A2A)] text-white"
          >
            Crear primera solicitud
          </Link>
        </article>
      ) : (
        <ul className="grid gap-3">
          {requests.map((r) => (
            <li key={r.request_id}>
              <Link
                to={`/detalles-solicitud/${r.request_id}`}
                className="block bg-white border border-[var(--color-neutral-200)] rounded-lg p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <p className="font-medium">
                      Solicitud #{r.request_id}
                    </p>
                    <p className="text-sm text-[var(--color-ink-muted)]">
                      {r.destination_country ?? "Destino sin especificar"}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="status-pill text-xs uppercase tracking-widest text-[var(--color-primary-700,#243117)] bg-[var(--color-primary-100,#e8efd9)] px-2 py-1 rounded">
                      {r.status ?? "—"}
                    </span>
                    <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                      {fmt(r.beginning_date)} — {fmt(r.ending_date)}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function fmt(d: string | Date | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toISOString().split("T")[0]!;
  } catch {
    return String(d);
  }
}
