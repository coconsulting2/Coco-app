/**
 * @module TravelRequestActionWrapper
 * @description Botón + modal de confirmación para aprobar/rechazar una
 * solicitud de viaje. Migrado a React Router 7: cero `apiRequest`, cero
 * `token`, cero `window.location`. Submitea al action de la route padre vía
 * `useFetcher` con el `intent` indicado; la action (p.ej.
 * `autorizar-solicitud.$id`) llama al use-case del slice approvals y maneja el
 * redirect. Paridad con el legacy authorize/decline-travel-request.
 */
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import ModalWrapper from "~/shared/ui/ModalWrapper";
import Toast from "~/shared/ui/Toast";

interface Props {
  request_id: number;
  /** Acción a ejecutar en la route padre. */
  intent: "approve" | "reject";
  title: string;
  message: string;
  modal_type: "success" | "warning";
  children: React.ReactNode;
  /** Comentario obligatorio en rechazo (paridad legacy decline). */
  comentario?: string;
}

type FetcherResult = { ok: true } | { ok: false; error: string; code?: string };

export default function TravelRequestActionWrapper({
  request_id,
  intent,
  title,
  message,
  modal_type,
  children,
  comentario,
}: Props) {
  const fetcher = useFetcher<FetcherResult>();
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const submitting = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok) {
      setToast({
        message:
          intent === "approve"
            ? "Solicitud autorizada exitosamente."
            : "Solicitud rechazada exitosamente.",
        type: "success",
      });
    } else {
      setToast({
        message: fetcher.data.error ?? "No se pudo completar la acción. Intenta de nuevo.",
        type: "error",
      });
    }
  }, [fetcher.state, fetcher.data, intent]);

  const handleConfirm = () => {
    const fd = new FormData();
    fd.set("intent", intent);
    fd.set("request_id", String(request_id));
    if (intent === "reject" && comentario) fd.set("comentario", comentario);
    fetcher.submit(fd, { method: "post" });
  };

  return (
    <>
      <ModalWrapper
        title={title}
        message={message}
        button_type={modal_type === "warning" ? "danger" : modal_type}
        modal_type={modal_type}
        onConfirm={handleConfirm}
        disabled={submitting}
      >
        {children}
      </ModalWrapper>
      {toast && <Toast message={toast.message} type={toast.type} />}
    </>
  );
}
