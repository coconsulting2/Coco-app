/**
 * @module TravelAgencyView
 * @description Dashboard Agencia de Viajes — atenciones pendientes.
 */
import { Link } from "react-router";

import EditorialHeader from "~/shared/ui/editorial/EditorialHeader";
import MetricCard from "~/shared/ui/editorial/MetricCard";

type RequestRow = {
  request_id: number;
  destination_country?: string | null;
  beginning_date?: string | Date | null;
  ending_date?: string | Date | null;
};

type Props = {
  userName: string;
  requests: RequestRow[];
};

function fmt(d: string | Date | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toISOString().split("T")[0]!;
  } catch {
    return String(d);
  }
}

export default function TravelAgencyView({ userName, requests }: Props) {
  return (
    <main>
      <EditorialHeader
        eyebrow="Coco / Agencia"
        title="Atenciones"
        subtitle={`${userName} · ${requests.length} solicitudes pendientes`}
      />

      <div className="flex mb-8">
        <MetricCard label="Pendientes" value={String(requests.length)} position="solo" />
      </div>

      {requests.length > 0 ? (
        <section className="card-editorial">
          <div className="px-6 py-4 border-b border-[var(--color-neutral-200)]">
            <h2 className="font-editorial text-lg font-normal text-[var(--color-ink)]">
              Solicitudes por atender
            </h2>
          </div>

          {requests.map((r, idx) => {
            const isLast = idx === requests.length - 1;
            return (
              <Link
                key={r.request_id}
                to={`/atender-solicitud/${r.request_id}`}
                className={[
                  "block px-6 py-4 flex items-center justify-between gap-6",
                  isLast ? "" : "border-b border-[var(--color-neutral-200)]",
                  "hover:bg-[var(--color-surface-secondary)] transition-colors",
                ].join(" ")}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-[var(--color-ink)] truncate">
                    Viaje a {r.destination_country ?? "—"}
                  </p>
                  <p className="text-xs text-[var(--color-ink-muted)] mt-0.5">
                    #{r.request_id} · {fmt(r.beginning_date)} – {fmt(r.ending_date)}
                  </p>
                </div>
                <span className="money-display text-lg text-[var(--color-ink)]">#{r.request_id}</span>
              </Link>
            );
          })}
        </section>
      ) : (
        <div className="card-editorial py-16 text-center">
          <p className="text-[var(--color-ink-muted)]">Sin atenciones pendientes</p>
        </div>
      )}
    </main>
  );
}
