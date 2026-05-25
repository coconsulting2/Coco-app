/**
 * @module RequestValidationStatus
 * @description Vista del Solicitante para enviar los comprobantes de una
 * solicitud a validación (transición de status 6 → 7). Prop-driven: recibe
 * `receipts` desde el loader y submitea vía `useFetcher` con intent
 * `send-for-validation` al action de la route padre. Sin llamadas al API legacy ni token.
 */
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import type { RequestReceiptsForValidation } from "~/contexts/receipts-cfdi";
import ModalWrapper from "~/shared/ui/ModalWrapper";
import Toast from "~/shared/ui/Toast";

interface Props {
  receipts: RequestReceiptsForValidation | null;
}

type FetcherResult =
  | { ok: true; alreadySubmitted: boolean; message: string }
  | { ok: false; error: string; code?: string };

const VALIDATION_BADGE: Record<string, string> = {
  Aprobado: "bg-success-50 text-success-700 border-success-300",
  Rechazado: "bg-danger-50 text-danger-600 border-danger-300",
  Pendiente: "bg-[var(--color-surface-secondary)] text-[var(--color-ink-muted)] border-[var(--color-neutral-300)]",
};

export default function RequestValidationStatus({ receipts }: Props) {
  const fetcher = useFetcher<FetcherResult>();
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok) {
      setToast({ message: fetcher.data.message, type: "success" });
    } else {
      setToast({ message: fetcher.data.error, type: "error" });
    }
  }, [fetcher.state, fetcher.data]);

  if (!receipts) {
    return (
      <div className="card-editorial p-6">
        <p className="text-sm text-[var(--color-ink-muted)]">
          No se encontró la solicitud.
        </p>
      </div>
    );
  }

  const canSubmit = receipts.requestStatusId === 6 && receipts.items.length > 0;
  const handleConfirm = () => {
    fetcher.submit({ intent: "send-for-validation" }, { method: "post" });
  };

  return (
    <>
      <section className="card-editorial overflow-hidden">
        <header className="px-5 py-4 border-b border-[var(--color-neutral-200)] flex items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-xl">Comprobantes de la solicitud</h2>
            <p className="text-sm text-[var(--color-ink-muted)] mt-1">
              {receipts.items.length} comprobante(s) registrado(s)
              {receipts.requestStatusName ? ` · Estado: ${receipts.requestStatusName}` : ""}.
            </p>
          </div>
        </header>

        {receipts.items.length === 0 ? (
          <div className="px-5 py-6 text-sm text-[var(--color-ink-muted)]">
            Esta solicitud aún no tiene comprobantes registrados.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-neutral-200)]">
            {receipts.items.map((item) => (
              <li key={item.receiptId} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium truncate">{item.receiptTypeName}</p>
                  {item.cfdi ? (
                    <p className="text-xs text-[var(--color-ink-muted)] truncate">
                      {item.cfdi.nombreEmisor} · {item.cfdi.rfcEmisor} · UUID {item.cfdi.uuid}
                    </p>
                  ) : (
                    <p className="text-xs text-[var(--color-ink-muted)]">Comprobante internacional</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="tabular-nums text-sm">${item.amount.toFixed(2)}</span>
                  <span
                    className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded border ${
                      VALIDATION_BADGE[item.validation] ?? VALIDATION_BADGE.Pendiente
                    }`}
                  >
                    {item.validation}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        <footer className="px-5 py-4 border-t border-[var(--color-neutral-200)] flex items-center justify-end gap-3">
          {!canSubmit && receipts.requestStatusId !== 6 && (
            <p className="text-xs text-[var(--color-ink-muted)] mr-auto">
              Solo puedes enviar a validación mientras la solicitud está en comprobación de gastos.
            </p>
          )}
          <ModalWrapper
            title="Enviar comprobantes a validación"
            message="¿Deseas enviar todos los comprobantes de esta solicitud a validación de Cuentas por Pagar?"
            button_type="success"
            modal_type="success"
            variant="filled"
            disabled={!canSubmit || fetcher.state !== "idle"}
            onConfirm={handleConfirm}
          >
            Enviar a validación
          </ModalWrapper>
        </footer>
      </section>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={toast.type === "error" ? 5000 : 3500}
        />
      )}
    </>
  );
}
