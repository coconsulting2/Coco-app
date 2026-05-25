/**
 * @module AproveReceiptsModal
 * @description Botón inline + modal de confirmación para aprobar UN
 * comprobante individual desde CxP. Submitea al action de la route padre
 * vía `useFetcher` con intent="approve". Espera que la route padre exponga
 * un action que llame al use-case `validateReceiptDecision` del slice
 * receipts-cfdi.
 */
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import ModalWrapper from "~/shared/ui/ModalWrapper";
import Toast from "~/shared/ui/Toast";

interface Props {
  receipt_id: number;
  title: string;
  message: string;
  modal_type: "success" | "warning";
  variant?: "filled" | "border" | "empty";
  children: React.ReactNode;
  disabled?: boolean;
  /** Callback opcional tras éxito (e.g. cerrar overlay, scroll). */
  onSuccess?: () => void;
}

type FetcherResult = { ok: true } | { ok: false; error: string; code?: string };

export default function AproveReceipStatus({
  receipt_id,
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
      setToast({ message: "Aprobado correctamente", type: "success" });
      onSuccess?.();
    } else {
      setToast({ message: fetcher.data.error ?? "No se pudo aprobar el comprobante.", type: "error" });
    }
  }, [fetcher.state, fetcher.data, onSuccess]);

  const handleConfirm = () => {
    fetcher.submit(
      { intent: "approve", receiptId: String(receipt_id) },
      { method: "post" },
    );
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
