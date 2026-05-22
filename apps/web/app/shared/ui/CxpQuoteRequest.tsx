/**
 * @module CxpQuoteRequest
 * @description UI de CxP para confirmar el monto aprobado de una Request.
 * Usa `useFetcher` para POSTear al action del route padre
 * `cotizar-solicitud.$id.tsx` — sin clientes HTTP a endpoints internos.
 */
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import Toast from "@components/Toast";
import { showAppAlert } from "@utils/appAlert";

interface Props {
  requestId: number;
  requestedFee: number;
  needsPlane?: boolean;
  needsHotel?: boolean;
}

type FetcherData =
  | { ok: true; newStatusId: 5 | 7; needsAgency: boolean }
  | { ok: false; error: string };

export default function CxpQuoteRequest({
  requestId,
  requestedFee,
  needsPlane = false,
  needsHotel = false,
}: Props) {
  const fetcher = useFetcher<FetcherData>();
  const [imposedFee, setImposedFee] = useState(
    () => (requestedFee > 0 ? String(requestedFee) : ""),
  );
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const needsAgency = needsPlane || needsHotel;

  const nextStepHint = needsAgency
    ? "Al confirmar, la solicitud pasará a Agencia de viajes para cotizar vuelo y/o hospedaje."
    : "Al confirmar, la solicitud pasará a comprobación de gastos del solicitante (sin paso de agencia).";

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok) {
      setToast({ message: "Monto aprobado correctamente.", type: "success" });
    } else {
      showAppAlert(fetcher.data.error, { variant: "error" });
    }
  }, [fetcher.state, fetcher.data]);

  const submitting = fetcher.state !== "idle";

  function handleSubmit() {
    const amount = Number(imposedFee);
    if (!Number.isFinite(amount) || amount < 0) {
      showAppAlert("Indica un monto aprobado válido (mayor o igual a 0).", {
        variant: "warning",
      });
      return;
    }
    const fd = new FormData();
    fd.set("intent", "confirmImposedFee");
    fd.set("imposedFee", String(amount));
    fetcher.submit(fd, { method: "post" });
  }

  return (
    <div className="w-full min-w-0 card-editorial p-6 md:p-8 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[var(--color-ink)]">Aprobación de monto</h2>
        <p className="text-sm text-[var(--color-ink-secondary)] mt-1">
          Cuentas por pagar — define el anticipo autorizado para la solicitud #{requestId}.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="rounded-lg border border-[var(--color-neutral-200)] bg-[var(--color-surface-secondary)] p-4 space-y-2 text-sm">
          <p className="text-[var(--color-ink)]">
            <span className="font-medium">Monto solicitado:</span>{" "}
            <span className="money-display text-base">
              ${Number(requestedFee).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </span>
          </p>
          <p className="text-[var(--color-ink-secondary)] leading-relaxed">{nextStepHint}</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--color-ink-secondary)] mb-1">
            Monto aprobado (MXN)
          </label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={imposedFee}
            onChange={(e) => setImposedFee(e.target.value)}
            className="w-full border border-[var(--color-neutral-300)] rounded-lg px-3 py-2.5 text-sm bg-[var(--color-surface-white)]"
            placeholder="Ej. 30000"
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-2 border-t border-[var(--color-neutral-200)]">
        <a
          href="/cotizaciones"
          className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancelar
        </a>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="px-5 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400"
        >
          {submitting ? "Guardando…" : "Confirmar monto"}
        </button>
      </div>

      {toast ? <Toast message={toast.message} type={toast.type} /> : null}
    </div>
  );
}
