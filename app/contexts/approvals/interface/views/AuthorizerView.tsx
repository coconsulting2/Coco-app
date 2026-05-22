/**
 * @module AuthorizerView
 * @description Dashboard N1/N2 — "Bandeja de aprobación" editorial.
 * Réplica fiel de AuthorizerView.astro legacy.
 */
import { Link } from "react-router";

import EditorialHeader from "~/shared/ui/editorial/EditorialHeader";
import MetricCard from "~/shared/ui/editorial/MetricCard";

type ApproverRequestRow = {
  request_id: number;
  requester_name?: string | null;
  department_name?: string | null;
  destination_country?: string | null;
  beginning_date?: string | Date | null;
  ending_date?: string | Date | null;
};

type Props = {
  userName: string;
  role: "N1" | "N2";
  requests: ApproverRequestRow[];
};

function fmt(d: string | Date | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toISOString().split("T")[0]!;
  } catch {
    return String(d);
  }
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function AuthorizerView({ userName, role, requests }: Props) {
  const roleLabel = role === "N1" ? "Jefe directo" : "Finanzas";

  return (
    <main>
      <EditorialHeader
        eyebrow={`Coco / Aprobaciones / ${roleLabel}`}
        title="Por revisar"
        subtitle={`${userName} · ${requests.length} solicitudes pendientes`}
      />

      <div className="flex mb-8">
        <MetricCard label="Pendientes" value={String(requests.length)} position="first" />
        <MetricCard
          label="Requieren atención hoy"
          value={String(Math.min(requests.length, 3))}
          detail="Respuesta a solicitudes urgentes"
          position="last"
        />
      </div>

      {requests.length > 0 ? (
        <section className="card-editorial">
          <div className="px-6 py-4 border-b border-[var(--color-neutral-200)]">
            <h2 className="font-editorial text-lg font-normal text-[var(--color-ink)]">
              Solicitudes por autorizar
            </h2>
          </div>

          {requests.map((r, idx) => {
            const isLast = idx === requests.length - 1;
            return (
              <Link
                key={r.request_id}
                to={`/autorizar-solicitud/${r.request_id}`}
                className={[
                  "block px-6 py-4 flex items-center justify-between gap-6",
                  isLast ? "" : "border-b border-[var(--color-neutral-200)]",
                  "hover:bg-[var(--color-surface-secondary)] transition-colors",
                ].join(" ")}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[var(--color-neutral-200)] text-[var(--color-ink-secondary)] flex-shrink-0">
                    <span className="text-xs font-semibold">
                      {initials(r.requester_name ?? "U")}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--color-ink)] truncate">
                      {r.requester_name ?? "Solicitante"}{" "}
                      {r.department_name && (
                        <span className="text-[var(--color-ink-muted)] font-normal text-xs uppercase tracking-wide ml-1">
                          {r.department_name}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-[var(--color-ink-muted)] mt-0.5 truncate">
                      Viaje a {r.destination_country ?? "—"} · {fmt(r.beginning_date)} – {fmt(r.ending_date)}
                    </p>
                  </div>
                </div>

                <span className="money-display text-lg text-[var(--color-ink)]">
                  #{r.request_id}
                </span>
              </Link>
            );
          })}

          {requests.length > 5 && (
            <div className="px-6 py-3 border-t border-[var(--color-neutral-200)] text-center">
              <Link
                to="/autorizaciones"
                className="text-sm text-primary-500 hover:text-primary-400 transition-colors"
              >
                Ver {requests.length} solicitudes →
              </Link>
            </div>
          )}
        </section>
      ) : (
        <div className="card-editorial py-16 text-center">
          <p className="text-[var(--color-ink-muted)]">No tienes solicitudes pendientes</p>
        </div>
      )}
    </main>
  );
}
