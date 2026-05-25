/**
 * @module CancelRequestModal
 * @description Botón + modal de confirmación para cancelar una solicitud.
 * Submitea `intent=cancel` al action de la route padre vía `useFetcher`
 * (use-case hex `cancelTravelRequest`). Sin llamadas al API legacy ni token.
 */
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import Modal from "~/shared/ui/Modal";

interface Props {
  id: number;
  disabled?: boolean;
  children: React.ReactNode;
}

type FetcherResult = { ok: true } | { ok: false; error: string; code?: string };

export default function CancelRequestModal({ id, disabled = false, children }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const fetcher = useFetcher<FetcherResult>();

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    setIsOpen(false);
  }, [fetcher.state, fetcher.data]);

  const cancelRequest = () => {
    fetcher.submit(
      { intent: "cancel", requestId: String(id) },
      { method: "post" },
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
