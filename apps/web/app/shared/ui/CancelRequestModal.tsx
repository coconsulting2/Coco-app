/**
 * @module CancelRequestModal
 * @description Botón + modal de confirmación para cancelar una solicitud.
 * Submitea `intent=cancel` al action de la route padre vía `useFetcher`
 * (use-case hex `cancelTravelRequest`). Sin llamadas al API legacy ni token.
 */
import { useEffect, useState } from "react";
import { useFetcher, useRevalidator } from "react-router";
import Modal from "~/shared/ui/Modal";

interface Props {
  id: number;
  disabled?: boolean;
  /**
   * Action de PÁGINA destino (no `/api`). Permite montar el modal en una vista
   * (p.ej. dashboard del solicitante) y enrutar la cancelación a la action de
   * otra ruta de página — `/detalles-solicitud/:id` — que ya implementa el
   * intent `cancel` con CSRF + RLS. Si se omite, submitea a la ruta actual.
   */
  action?: string;
  children: React.ReactNode;
}

type FetcherResult = { ok: true } | { ok: false; error: string; code?: string };

export default function CancelRequestModal({ id, disabled = false, action, children }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const fetcher = useFetcher<FetcherResult>();
  const revalidator = useRevalidator();

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    setIsOpen(false);
    if (fetcher.data.ok) revalidator.revalidate();
  }, [fetcher.state, fetcher.data, revalidator]);

  const cancelRequest = () => {
    fetcher.submit(
      { intent: "cancel", requestId: String(id) },
      action ? { method: "post", action } : { method: "post" },
    );
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        style={disabled ? { opacity: 0.5, pointerEvents: "none" } : undefined}
        className="hover:scale-110 transform transition-transform duration-200"
      >
        {children}
      </button>

      <Modal
        title="Cancelar Solicitud"
        message="¿Estás seguro de que deseas cancelar esta solicitud?"
        type="confirm"
        show={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={cancelRequest}
      />
    </>
  );
}
