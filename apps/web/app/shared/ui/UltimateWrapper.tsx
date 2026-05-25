/**
 * @module UltimateWrapper
 * @description Botón + modal para desactivar un usuario (Admin). Migrado a
 * React Router 7: cero `apiRequest`, cero `token`, cero `window.location`.
 * Submitea al action de la route padre vía `useFetcher` con
 * `intent="deactivateUser"`; la action llama al use-case del slice identity y
 * maneja el redirect.
 */
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import ModalWrapper from "~/shared/ui/ModalWrapper";
import Toast from "~/shared/ui/Toast";

interface Props {
  user_id: number;
  title: string;
  message: string;
  modal_type: "success" | "warning";
  children: React.ReactNode;
  redirectTo?: string;
}

type FetcherResult = { ok: true } | { ok: false; error: string; code?: string };

export default function UltimateWrapper({
  user_id,
  title,
  message,
  modal_type,
  children,
  redirectTo = "/dashboard",
}: Props) {
  const fetcher = useFetcher<FetcherResult>();
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const submitting = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok) {
      setToast({ message: "Usuario desactivado exitosamente.", type: "success" });
    } else {
      setToast({
        message: fetcher.data.error ?? "No se pudo desactivar el usuario.",
        type: "error",
      });
    }
  }, [fetcher.state, fetcher.data]);

  const handleConfirm = () => {
    const fd = new FormData();
    fd.set("intent", "deactivateUser");
    fd.set("user_id", String(user_id));
    fd.set("redirectTo", redirectTo);
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
