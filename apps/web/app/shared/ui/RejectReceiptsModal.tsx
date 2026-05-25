/**
 * @module RejectReceiptsModal
 * @description Botón inline + modal con textarea para rechazar UN
 * comprobante individual desde CxP. Submitea al action de la route padre
 * vía `useFetcher` con intent="reject" y comentario obligatorio.
 */
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import Modal from "~/shared/ui/Modal";
import Toast from "~/shared/ui/Toast";
import { getButtonClasses } from "~/shared/types/button";

interface Props {
  receipt_id: number;
  request_id: number;
  receipt_type_name?: string;
  disabled?: boolean;
  children: React.ReactNode;
  /** Callback opcional tras éxito. */
  onSuccess?: () => void;
}

type FetcherResult = { ok: true } | { ok: false; error: string; code?: string };

export default function RejectReceipStatus({
  receipt_id,
  request_id,
  receipt_type_name,
  disabled = false,
  children,
  onSuccess,
}: Props) {
  const fetcher = useFetcher<FetcherResult>();
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const submitting = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok) {
      setOpen(false);
      setComment("");
      setToast({ message: "Comprobante rechazado.", type: "success" });
      onSuccess?.();
    } else {
      setToast({ message: fetcher.data.error ?? "No se pudo rechazar el comprobante.", type: "error" });
    }
  }, [fetcher.state, fetcher.data, onSuccess]);

  const handleConfirm = () => {
    const c = comment.trim();
    if (!c) {
      setToast({ message: "El comentario es obligatorio para rechazar.", type: "error" });
      return;
    }
    fetcher.submit(
      { intent: "reject", receiptId: String(receipt_id), comentario: c },
      { method: "post" },
    );
  };

  const btnClass = getButtonClasses({
    variant: "filled",
    color: "danger",
    size: "medium",
  });

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!disabled) setOpen(true);
        }}
        className={`${btnClass} pointer-events-auto transition-transform duration-200 hover:scale-105 min-h-11 min-w-11`}
        style={disabled ? { opacity: 0.5, pointerEvents: "none" } : undefined}
        disabled={disabled}
      >
        {children}
      </button>

      <Modal
        title="Rechazar comprobante"
        message="Indique el motivo del rechazo. El comentario quedará visible en el chat de la solicitud para el solicitante."
        type="warning"
        show={open}
        onClose={() => {
          if (!submitting) {
            setOpen(false);
            setComment("");
          }
        }}
        onConfirm={submitting ? undefined : handleConfirm}
        confirmLabel={submitting ? "Guardando…" : "Rechazar"}
      >
        <label
          className="block text-sm text-[var(--color-ink-secondary)] mb-1"
          htmlFor={`reject-receipt-${receipt_id}`}
        >
          Comentario (obligatorio)
        </label>
        <textarea
          id={`reject-receipt-${receipt_id}`}
          className="w-full min-h-[100px] border border-[var(--color-neutral-300)] rounded-[var(--radius-md)] p-2 text-sm text-[var(--color-ink)]"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={
            receipt_type_name
              ? `Motivo del rechazo de ${receipt_type_name}…`
              : "Motivo del rechazo…"
          }
          disabled={submitting}
        />
        <p className="text-xs text-[var(--color-ink-muted)] mt-2">
          Solicitud #{request_id} · también puedes escribir en el chat más abajo.
        </p>
      </Modal>

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
