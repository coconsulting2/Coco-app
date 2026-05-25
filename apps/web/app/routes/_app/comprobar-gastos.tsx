/**
 * @module comprobar-gastos (dashboard del Solicitante)
 * @description Lista las solicitudes del usuario en estados de comprobación
 * (status 6 = Comprobación gastos del viaje, 7 = Validación de comprobantes).
 * Loader llama `listTravelRequestsByUserAndStatusIds`. Link a
 * `comprobar-solicitud/:id` (subir comprobantes) o `detalles-solicitud/:id`.
 */
import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";

import { requirePermissions, runInTenant } from "~/platform/session/requireUser.server";
import { listTravelRequestsByUserAndStatusIds } from "~/contexts/travel-requests/index.js";

export function meta() {
  return [{ title: "Mis comprobaciones — CocoConsulting" }];
}

const STATUS_IDS = [6, 7];

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requirePermissions(request, "expense:submit");
  const rows = await runInTenant(session, async () =>
    listTravelRequestsByUserAndStatusIds({
      userId: Number(session.user.user_id),
      statusIds: STATUS_IDS,
    }),
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
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">Coco / Comprobaciones</p>
        <h1 className="font-serif text-3xl md:text-4xl">Mis comprobaciones</h1>
        <p className="text-sm text-[var(--color-ink-muted)]">
          Solicitudes en proceso de comprobación de gastos.
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
        No tienes solicitudes en comprobación.
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
              <td className="px-4 py-2 space-x-3">
                <Link
                  to={`/comprobar-solicitud/${r.requestId}`}
                  className="text-primary-600 hover:underline"
                >
                  Comprobar
                </Link>
                <Link
                  to={`/detalles-solicitud/${r.requestId}`}
                  className="text-[var(--color-ink-secondary)] hover:underline"
                >
                  Detalle
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
