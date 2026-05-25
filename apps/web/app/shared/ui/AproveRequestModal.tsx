/**
 * @module AproveRequestModal
 * @description Botón inline + modal de confirmación para que la Agencia marque
 * una solicitud como atendida (sin vuelo/hospedaje requerido). Submitea al
 * action de la route padre vía `useFetcher` con intent="finalize". Espera que
 * la route padre (`atender-solicitud.$id`) exponga un action que llame al
 * use-case `markAttendedByAgency` del slice travel-agency — paridad 1:1 con el
 * legacy `PUT /travel-agent/attend-travel-request/:id`.
 *
 * Prop-driven: recibe `request_id`. Cero apiRequest / token; la sesión y CSRF
 * los resuelve el action de la route en el servidor.
 */
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import ModalWrapper from "~/shared/ui/ModalWrapper";
import Toast from "~/shared/ui/Toast";

interface Props {
  request_id: number;
  title: string;
  message: string;
  modal_type: "success" | "warning";
  variant?: "filled" | "border" | "empty";
  children: React.ReactNode;
  disabled?: boolean;
  /** Callback opcional tras éxito (e.g. cerrar overlay). */
  onSuccess?: () => void;
}

type FetcherResult =
  | { ok: true; intent?: string }
  | { ok: false; intent?: string; error: string; code?: string };

export default function AproveRequestStatus({
  request_id,
  title,
  message,
  modal_type,
  variant,
  children,
  disabled = false,
  onSuccess,
}: Props) {
  const fetcher = useFetcher<FetcherResult>();
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok) {
      setToast({ message: "Comprobante enviado exitosamente.", type: "success" });
      onSuccess?.();
    } else {
      setToast({
        message: fetcher.data.error ?? "No se pudo completar la solicitud.",
        type: "error",
      });
    }
  }, [fetcher.state, fetcher.data, onSuccess]);

  const handleConfirm = () => {
    fetcher.submit({ intent: "finalize" }, { method: "post" });
  };

  return (
    <>
      <ModalWrapper
        title={title}
        message={message}
        button_type={modal_type === "warning" ? "danger" : modal_type}
        modal_type={modal_type}
        onConfirm={handleConfirm}
        variant={variant}
        disabled={disabled || fetcher.state !== "idle"}
      >
        {children}
      </ModalWrapper>
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
