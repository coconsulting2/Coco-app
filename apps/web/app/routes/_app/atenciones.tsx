/**
 * @module atenciones
 * @description Bandeja Agencia de viajes — lista solicitudes en status 5
 * (Atención Agencia de Viajes) + 9 (Cancelados, para visibilidad histórica).
 * Loader llama use-case hex `listTravelRequestsByStatusIds`. Renderiza
 * tabla simple con link a `atender-solicitud/:id`.
 */
import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";

import { requirePermissions, runInTenant } from "~/platform/session/requireUser.server";
import { listTravelRequestsByStatusIds } from "~/contexts/travel-requests/index.js";

export function meta() {
  return [{ title: "Atenciones — CocoConsulting" }];
}

const STATUS_IDS = [5, 9];

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requirePermissions(request, "travel_agent:attend");
  const rows = await runInTenant(session, async () =>
    listTravelRequestsByStatusIds({ statusIds: STATUS_IDS }),
  );
  return { rows };
}

type LoaderData = Awaited<ReturnType<typeof loader>>;
type Row = LoaderData["rows"][number];

export default function PageRoute() {
  const { rows } = useLoaderData() as LoaderData;

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">Coco / Agencia / Atenciones</p>
        <h1 className="font-serif text-3xl md:text-4xl">Atenciones</h1>
        <p className="text-sm text-[var(--color-ink-muted)]">
          Solicitudes en atención de agencia + canceladas (histórico).
        </p>
      </header>

      <RequestsTable rows={rows} />
    </section>
  );
}

function RequestsTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <div className="card-editorial p-6 text-sm text-[var(--color-ink-muted)]">
        No hay solicitudes en atención.
      </div>
    );
  }
  return (
    <div className="card-editorial overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-surface-secondary)] text-left">
          <tr>
            <th className="px-4 py-2">ID</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Destino</th>
            <th className="px-4 py-2">Salida</th>
            <th className="px-4 py-2">Regreso</th>
            <th className="px-4 py-2">Acción</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.requestId} className="border-t border-[var(--color-neutral-200)]">
              <td className="px-4 py-2 tabular-nums">{r.requestId}</td>
              <td className="px-4 py-2">{r.requestStatus}</td>
              <td className="px-4 py-2">{r.destinationCountry ?? "—"}</td>
              <td className="px-4 py-2">{fmtDate(r.beginningDate)}</td>
              <td className="px-4 py-2">{fmtDate(r.endingDate)}</td>
              <td className="px-4 py-2">
                <Link
                  to={`/atender-solicitud/${r.requestId}`}
                  className="text-primary-600 hover:underline"
                >
                  Abrir
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function fmtDate(date: string | Date | null): string {
  if (!date) return "—";
  try {
    return new Date(date).toISOString().split("T")[0]!;
  } catch {
    return String(date);
  }
}
