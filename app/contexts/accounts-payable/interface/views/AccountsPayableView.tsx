/**
 * @module AccountsPayableView
 * @description Dashboard CxP — "Revisión financiera" editorial.
 * Réplica fiel de AccountsPayableView.astro legacy.
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
  requestsInCotizar: RequestRow[];
  requestsInComprobar: RequestRow[];
};

function fmt(d: string | Date | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toISOString().split("T")[0]!;
  } catch {
    return String(d);
  }
}

function Section({
  title,
  subtitle,
  requests,
  urlBase,
  emptyMessage,
}: {
  title: string;
  subtitle: string;
  requests: RequestRow[];
  urlBase: string;
  emptyMessage: string;
}) {
  return (
    <section className="card-editorial">
      <div className="px-6 py-4 border-b border-[var(--color-neutral-200)]">
        <h2 className="font-editorial text-lg font-normal text-[var(--color-ink)]">{title}</h2>
        <p className="eyebrow text-xs mt-1">{subtitle}</p>
      </div>
      {requests.length === 0 ? (
        <p className="px-6 py-8 text-center text-[var(--color-ink-muted)]">{emptyMessage}</p>
      ) : (
        requests.map((r, idx) => {
          const isLast = idx === requests.length - 1;
          return (
            <Link
              key={r.request_id}
              to={`/${urlBase}/${r.request_id}`}
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
        })
      )}
    </section>
  );
}

export default function AccountsPayableView({
  userName,
  requestsInCotizar,
  requestsInComprobar,
}: Props) {
  const total = requestsInCotizar.length + requestsInComprobar.length;
  return (
    <main>
      <EditorialHeader
        eyebrow="Coco / Aprobaciones / Finanzas"
        title="Revisión financiera"
        subtitle={`${userName} · Cuentas por pagar`}
      />

      <div className="flex mb-8">
        <MetricCard label="Por cotizar" value={String(requestsInCotizar.length)} position="first" />
        <MetricCard label="Por comprobar" value={String(requestsInComprobar.length)} position="middle" />
        <MetricCard label="Total pendientes" value={String(total)} position="last" />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Section
          title="Solicitudes por cotizar"
          subtitle="Pendiente de cotización"
          requests={requestsInCotizar}
          urlBase="cotizar-solicitud"
          emptyMessage="No hay solicitudes por cotizar"
        />
        <Section
          title="Solicitudes por comprobar"
          subtitle="Pendiente de validación de comprobantes"
          requests={requestsInComprobar}
          urlBase="comprobar-gastos"
          emptyMessage="No hay solicitudes por comprobar"
        />
      </div>
    </main>
  );
}
