/**
 * @module ApproverDecisionHistoryList
 * @description Lista prop-driven del HISTÓRICO de decisiones de un aprobador
 * (N1/N2): solicitudes que él ya aprobó / rechazó / reasignó / escaló. A
 * diferencia de `AuthRequestsList` (bandeja de pendientes, con acción
 * "autorizar"), aquí cada fila enlaza al detalle de solo lectura
 * (`/detalles-solicitud/:id`). Sin fetch interno: recibe `rows` del loader.
 */
import { Link } from "react-router";

export interface ApproverDecisionRow {
  request_id: number;
  action: "APROBADO" | "RECHAZADO" | "ESCALADO" | "REASIGNADO";
  decided_at: string | null;
  request_status: string | null;
  requester_name: string | null;
  destination_country: string | null;
  beginning_date: string | null;
  ending_date: string | null;
  comentario: string | null;
}

const ACTION_LABEL: Record<ApproverDecisionRow["action"], string> = {
  APROBADO: "Aprobada",
  RECHAZADO: "Rechazada",
  ESCALADO: "Escalada",
  REASIGNADO: "Reasignada",
};

function fmtDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toISOString().split("T")[0]!;
  } catch {
    return value;
  }
}

export default function ApproverDecisionHistoryList({
  rows,
}: {
  rows: ApproverDecisionRow[];
}) {
  if (rows.length === 0) {
    return (
      <div className="card-editorial p-8 text-center">
        <p className="text-sm text-[var(--color-ink-muted)]">
          Aún no has tomado decisiones sobre ninguna solicitud.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="card-editorial min-w-[640px]">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-[var(--color-neutral-200)] text-left text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">
              <th className="px-6 py-3 font-medium">ID Viaje</th>
              <th className="px-6 py-3 font-medium">Decisión</th>
              <th className="px-6 py-3 font-medium">Solicitante</th>
              <th className="px-6 py-3 font-medium">Destino</th>
              <th className="px-6 py-3 font-medium">Fecha decisión</th>
              <th className="px-6 py-3 font-medium">Estado actual</th>
              <th className="px-6 py-3 font-medium text-center">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={`${row.request_id}-${index}`}
                className="border-b border-[var(--color-neutral-200)] text-sm text-[var(--color-ink-secondary)]"
              >
                <td className="px-6 py-3 tabular-nums">#{row.request_id}</td>
                <td className="px-6 py-3">{ACTION_LABEL[row.action]}</td>
                <td className="px-6 py-3">{row.requester_name ?? "—"}</td>
                <td className="px-6 py-3">{row.destination_country ?? "—"}</td>
                <td className="px-6 py-3 tabular-nums">{fmtDate(row.decided_at)}</td>
                <td className="px-6 py-3">{row.request_status ?? "—"}</td>
                <td className="px-6 py-3 text-center">
                  <Link
                    to={`/detalles-solicitud/${row.request_id}`}
                    className="inline-block rounded-[var(--radius-md)] border border-[var(--color-neutral-300)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-surface-secondary)]"
                  >
                    Ver más
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
