/**
 * @module comprobaciones
 * @description Bandeja CxP — lista solicitudes en status 7 (Validación de
 * comprobantes) y 8 (Finalizado, para visibilidad histórica). Loader llama
 * `listTravelRequestsByStatusIds`. Link a `comprobar-gastos/:id` para
 * validar receipts uno por uno (use-case hex `validateReceiptDecision`).
 */
import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";

import { requirePermissions, runInTenant } from "~/platform/session/requireUser.server";
import { listTravelRequestsByStatusIds } from "~/contexts/travel-requests/index.js";

export function meta() {
  return [{ title: "Comprobaciones — CocoConsulting" }];
}

const STATUS_IDS = [7, 8];

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requirePermissions(request, "receipt:validate");
  const rows = await runInTenant(session, async () =>
    listTravelRequestsByStatusIds({ statusIds: STATUS_IDS }),
  );
  return { rows };
}

type LoaderData = Awaited<ReturnType<typeof loader>>;
type Row = LoaderData["rows"][number];

export default function PageRoute() {
  const { rows } = useLoaderData() as LoaderData;

  const pendientes = rows.filter((r) => r.requestStatus !== "Finalizado");
  const finalizadas = rows.filter((r) => r.requestStatus === "Finalizado");

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">Coco / CxP / Comprobaciones</p>
        <h1 className="font-serif text-3xl md:text-4xl">Comprobaciones</h1>
        <p className="text-sm text-[var(--color-ink-muted)]">
          Solicitudes con comprobantes pendientes de validar + histórico finalizadas.
        </p>
      </header>

      <article className="space-y-3">
        <h2 className="font-serif text-2xl">Pendientes de validar</h2>
        <RequestsTable rows={pendientes} emptyLabel="No hay comprobaciones pendientes." />
      </article>

      <article className="space-y-3">
        <h2 className="font-serif text-2xl">Finalizadas</h2>
        <RequestsTable rows={finalizadas} emptyLabel="Aún no hay solicitudes finalizadas." />
      </article>
    </section>
  );
}

function RequestsTable({ rows, emptyLabel }: { rows: Row[]; emptyLabel: string }) {
  if (rows.length === 0) {
    return (
      <div className="card-editorial p-6 text-sm text-[var(--color-ink-muted)]">{emptyLabel}</div>
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
                  to={`/comprobar-gastos/${r.requestId}`}
                  className="text-primary-600 hover:underline"
                >
                  Validar
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
