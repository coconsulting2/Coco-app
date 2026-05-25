/**
 * Author: Emiliano Deyta
 *
 * Description:
 * Displays the CFDI validation status against the SAT with a color-coded
 * badge and the last verification timestamp.
 *
 * Prop-driven: the SAT validation result is resolved server-side by the loader
 * of the route that renders this badge (use-case `getReceiptSatValidation` del
 * slice receipts-cfdi) y se pasa como prop `validation`. Cero apiRequest /
 * fetch / token — la data interna viaja por loader RR7, no por el cliente.
 **/

import {
  SAT_STATUS_LABELS,
  SAT_STATUS_STYLES,
  SAT_STATUS_DOT,
} from "~/shared/config/cfdiValidation";
import type { SatStatus, SatValidationResponse } from "~/shared/config/cfdiValidation";

interface Props {
  /**
   * Resultado de validación SAT resuelto por el loader. `null` cuando el CFDI
   * aún no tiene una validación almacenada.
   */
  validation: SatValidationResponse | null;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CfdiSatBadge({ validation }: Props) {
  if (!validation) {
    return (
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
        <span className="status-pill bg-[var(--color-neutral-100)] text-[var(--color-neutral-500)]">
          Sin datos
        </span>
      </div>
    );
  }

  const status: SatStatus = validation.status;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      {/* Status badge */}
      <span
        className={`status-pill ${SAT_STATUS_STYLES[status]} inline-flex items-center gap-1.5`}
      >
        <span className={`w-2 h-2 rounded-full ${SAT_STATUS_DOT[status]}`} />
        {SAT_STATUS_LABELS[status]}
      </span>

      {/* Verification date */}
      {validation.verified_at && (
        <span className="text-xs text-[var(--color-ink-muted)]">
          Verificado: {formatDate(validation.verified_at)}
        </span>
      )}
    </div>
  );
}
