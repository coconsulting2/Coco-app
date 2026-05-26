/**
 * @module cotizaciones
 * @description Bandeja CxP — lista solicitudes en status 4 (Cotización del
 * Viaje). Tras la aprobación de N2 las solicitudes quedan en status 4 a la
 * espera de que CxP confirme el monto aprobado. Loader llama
 * `listTravelRequestsByStatusIds`. Link a `cotizar-solicitud/:id`.
 */
import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";

import { requirePermissions, runInTenant } from "~/platform/session/requireUser.server";
import { listTravelRequestsByStatusIds } from "~/contexts/travel-requests/index.js";

export function meta() {
  return [{ title: "Cotizaciones — CocoConsulting" }];
}

const STATUS_IDS = [4];

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requirePermissions(request, "accounts_payable:attend");
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
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">Coco / CxP / Cotizaciones</p>
        <h1 className="font-serif text-3xl md:text-4xl">Cotizaciones pendientes</h1>
        <p className="text-sm text-[var(--color-ink-muted)]">
          Solicitudes esperando aprobación de cotización.
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
        No hay cotizaciones pendientes.
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
                  to={`/cotizar-solicitud/${r.requestId}`}
                  className="text-primary-500 hover:underline"
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
