/**
 * @module ApplicantView
 * @description Dashboard del Solicitante — "Mis pendientes" editorial.
 * Réplica fiel de ApplicantView.astro legacy con MetricCards + lista de
 * solicitudes activas (status != Borrador) + acciones por estado.
 */
import { Link } from "react-router";

import EditorialHeader from "~/shared/ui/editorial/EditorialHeader";
import MetricCard from "~/shared/ui/editorial/MetricCard";
import Button from "~/shared/ui/Button";
import MaterialIcon from "~/shared/ui/MaterialIcon";

type RequestRow = {
  request_id: number;
  status: string;
  destination_country: string | null;
  beginning_date?: string | Date | null;
  ending_date?: string | Date | null;
};

type Props = {
  userName: string;
  requests: RequestRow[];
};

const STATUS_PILL: Record<string, string> = {
  "Primera Revisión": "status-pill--review",
  "Segunda Revisión": "status-pill--review",
  "Cotización del Viaje": "status-pill--pending",
  "Atención Agencia de Viajes": "status-pill--pending",
  "Comprobación gastos del viaje": "status-pill--review",
  "Validación de comprobantes": "status-pill--review",
};

function fmt(d: string | Date | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toISOString().split("T")[0]!;
  } catch {
    return String(d);
  }
}

export default function ApplicantView({ userName, requests }: Props) {
  const inReview = requests.filter((r) =>
    ["Primera Revisión", "Segunda Revisión"].includes(r.status),
  ).length;
  const pending = requests.filter((r) =>
    ["Cotización del Viaje", "Atención Agencia de Viajes"].includes(r.status),
  ).length;
  const toVerify = requests.filter((r) =>
    ["Comprobación gastos del viaje", "Validación de comprobantes"].includes(r.status),
  ).length;

  return (
    <main>
      <EditorialHeader
        eyebrow="Coco / Mis solicitudes"
        title={`Hola, ${userName}`}
        subtitle={`Tienes ${requests.length} solicitudes activas`}
      >
        <Link to="/crear-solicitud">
          <Button variant="filled" color="primary" size="medium">
            + Nueva solicitud
          </Button>
        </Link>
      </EditorialHeader>

      {/* Metric cards joined */}
      <div className="flex mb-8">
        <MetricCard label="En revisión" value={String(inReview)} position="first" />
        <MetricCard label="Por comprobar" value={String(toVerify)} position="middle" />
        <MetricCard label="En proceso" value={String(pending)} position="last" />
      </div>

      {requests.length > 0 && (
        <section className="card-editorial">
          <div className="px-6 py-4 border-b border-[var(--color-neutral-200)]">
            <h2 className="font-editorial text-lg font-normal text-[var(--color-ink)]">
              Requieren tu atención
            </h2>
          </div>

          {requests.map((r, index) => {
            const isEditable = r.status === "Primera Revisión";
            const isNotCancelable =
              r.status === "Comprobación gastos del viaje" ||
              r.status === "Validación de comprobantes";
            const canComprobar = [
              "Cotización del Viaje",
              "Atención Agencia de Viajes",
              "Comprobación gastos del viaje",
              "Validación de comprobantes",
            ].includes(r.status);
            const isLast = index === requests.length - 1;

            return (
              <div
                key={r.request_id}
                className={[
                  "px-4 sm:px-6 py-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6",
                  isLast ? "" : "border-b border-[var(--color-neutral-200)]",
                  "hover:bg-[var(--color-surface-secondary)] transition-colors",
                ].join(" ")}
              >
                <div className="flex gap-3 sm:gap-4 min-w-0 w-full lg:flex-1 lg:items-center">
                  <span className="font-editorial text-lg text-[var(--color-ink-muted)] tabular-nums w-8 shrink-0 text-right pt-0.5">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <Link to={`/detalles-solicitud/${r.request_id}`} className="block min-w-0 flex-1">
                    <p className="font-medium text-[var(--color-ink)] break-words">
                      {r.destination_country ?? "Destino sin especificar"}
                    </p>
                    <p className="text-xs text-[var(--color-ink-muted)] mt-1 leading-snug">
                      #{r.request_id} · {fmt(r.beginning_date)} – {fmt(r.ending_date)}
                    </p>
                  </Link>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full min-w-0 pl-11 lg:pl-0 lg:w-auto lg:max-w-full lg:flex-shrink-0 lg:justify-end">
                  <span
                    className={`status-pill shrink-0 max-w-full ${STATUS_PILL[r.status] ?? "status-pill--review"}`}
                  >
                    {r.status}
                  </span>

                  <div className="flex items-center gap-2 flex-wrap ml-auto lg:ml-0">
                    {isEditable && (
                      <Link to={`/editar-solicitud/${r.request_id}`}>
                        <Button variant="border" color="primary" size="small">Editar</Button>
                      </Link>
                    )}
                    {canComprobar && (
                      <Link to={`/comprobar-solicitud/${r.request_id}`}>
                        <Button variant="filled" color="primary" size="small">Comprobar</Button>
                      </Link>
                    )}
                    {!isNotCancelable && (
                      <Link
                        to={`/detalles-solicitud/${r.request_id}`}
                        aria-label="Ver detalles para cancelar"
                        className="p-1.5 rounded-[var(--radius-md)] text-[var(--color-ink-muted)] hover:bg-accent-50 hover:text-accent-400 transition-colors cursor-pointer"
                      >
                        <MaterialIcon icon="delete" color="currentColor" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {requests.length === 0 && (
        <div className="card-editorial py-16 text-center">
          <p className="text-[var(--color-ink-muted)]">No tienes viajes agendados</p>
          <Link to="/crear-solicitud" className="mt-4 inline-block">
            <Button variant="filled" color="primary" size="medium">
              Solicita tu primer viaje
            </Button>
          </Link>
        </div>
      )}
    </main>
  );
}
