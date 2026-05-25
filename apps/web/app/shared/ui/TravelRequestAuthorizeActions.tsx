/**
 * @module TravelRequestAuthorizeActions
 * @description Acciones N1/N2 (aprobar/rechazar/reasignar) sobre una
 * solicitud. Usa `useFetcher` para POSTear al action del route padre
 * (`autorizar-solicitud.$id.tsx`) — sin clientes HTTP a endpoints internos
 * para cumplir la regla de aislamiento de shared/ui.
 */
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import Modal from "~/shared/ui/Modal";
import Toast from "~/shared/ui/Toast";
import { getButtonClasses } from "~/shared/types/button";

interface Props {
  request_id: number;
  /** Detalle opcional para mostrar contexto (el route padre lo carga en loader). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request?: any;
}

type FetcherActionResult =
  | { ok: true }
  | { ok: false; error: string; code?: string };

export default function TravelRequestAuthorizeActions({
  request_id,
}: Props) {
  const fetcher = useFetcher<FetcherActionResult>();
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [reassignOpen, setReassignOpen] = useState(false);
  const [targetUserId, setTargetUserId] = useState("");
  const [motivo, setMotivo] = useState("");

  // Reacciona a la respuesta del action — el redirect a /dashboard lo maneja
  // RR automáticamente; aquí solo gestionamos errores y el feedback de reassign.
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok) {
      setApproveOpen(false);
      setRejectOpen(false);
      setReassignOpen(false);
      setComment("");
      setTargetUserId("");
      setMotivo("");
      setToast({ message: "Acción completada.", type: "success" });
    } else {
      setToast({ message: fetcher.data.error, type: "error" });
    }
  }, [fetcher.state, fetcher.data]);

  const submitting = fetcher.state !== "idle";

  function submit(formData: FormData) {
    fetcher.submit(formData, { method: "post" });
  }

  function handleApprove() {
    const fd = new FormData();
    fd.set("intent", "approve");
    submit(fd);
  }

  function handleReject() {
    const c = comment.trim();
    if (!c) {
      setToast({
        message: "El comentario es obligatorio para rechazar.",
        type: "error",
      });
      return;
    }
    const fd = new FormData();
    fd.set("intent", "reject");
    fd.set("comentario", c);
    submit(fd);
  }

  function handleReassign() {
    const uid = Number(targetUserId.trim());
    const m = motivo.trim();
    if (!Number.isFinite(uid) || uid < 1) {
      setToast({
        message: "Indica un ID de usuario destino válido.",
        type: "error",
      });
      return;
    }
    if (!m) {
      setToast({ message: "El motivo es obligatorio.", type: "error" });
      return;
    }
    const fd = new FormData();
    fd.set("intent", "reassign");
    fd.set("targetUserId", String(uid));
    fd.set("motivo", m);
    submit(fd);
  }

  const btnPrimary = getButtonClasses({
    variant: "filled",
    color: "success",
    size: "medium",
  });
  const btnDanger = getButtonClasses({
    variant: "filled",
    color: "danger",
    size: "medium",
  });
  const btnNeutral = getButtonClasses({
    variant: "border",
    color: "primary",
    size: "medium",
  });

  return (
    <>
      <div className="flex flex-wrap justify-end gap-4 mt-8">
        <button
          type="button"
          className={btnPrimary}
          disabled={submitting}
          onClick={() => setApproveOpen(true)}
        >
          Aceptar
        </button>
        <button
          type="button"
          className={btnDanger}
          disabled={submitting}
          onClick={() => setRejectOpen(true)}
        >
          Rechazar
        </button>
        <button
          type="button"
          className={btnNeutral}
          disabled={submitting}
          onClick={() => setReassignOpen(true)}
        >
          Reasignar
        </button>
      </div>

      <Modal
        title="Confirmar autorización"
        message={`¿Está seguro de que desea autorizar la solicitud #${request_id}?`}
        type="success"
        show={approveOpen}
        onClose={() => setApproveOpen(false)}
        onConfirm={handleApprove}
        confirmLabel={submitting ? "Procesando..." : "Confirmar"}
      />

      <Modal
        title="Rechazar autorización"
        message="Indique el motivo del rechazo (obligatorio)."
        type="warning"
        show={rejectOpen}
        onClose={() => {
          setRejectOpen(false);
          setComment("");
        }}
        onConfirm={handleReject}
        confirmLabel={submitting ? "Procesando..." : "Rechazar"}
      >
        <label
          className="block text-sm text-[var(--color-ink-secondary)] mb-1"
          htmlFor="reject-comment"
        >
          Comentario
        </label>
        <textarea
          id="reject-comment"
          className="w-full min-h-[100px] border border-[var(--color-neutral-300)] rounded-[var(--radius-md)] p-2 text-sm"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Motivo del rechazo…"
        />
      </Modal>

      <Modal
        title="Reasignar aprobación"
        message="Asigne otro usuario con rol N1 o N2 e indique el motivo."
        type="confirm"
        show={reassignOpen}
        onClose={() => {
          setReassignOpen(false);
          setTargetUserId("");
          setMotivo("");
        }}
        onConfirm={handleReassign}
        confirmLabel={submitting ? "Procesando..." : "Guardar"}
      >
        <label
          className="block text-sm text-[var(--color-ink-secondary)] mb-1"
          htmlFor="reassign-user"
        >
          ID usuario destino
        </label>
        <input
          id="reassign-user"
          type="number"
          min={1}
          className="w-full border border-[var(--color-neutral-300)] rounded-[var(--radius-md)] p-2 text-sm mb-3"
          value={targetUserId}
          onChange={(e) => setTargetUserId(e.target.value)}
        />
        <label
          className="block text-sm text-[var(--color-ink-secondary)] mb-1"
          htmlFor="reassign-motivo"
        >
          Motivo
        </label>
        <textarea
          id="reassign-motivo"
          className="w-full min-h-[80px] border border-[var(--color-neutral-300)] rounded-[var(--radius-md)] p-2 text-sm"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Motivo de la reasignación…"
        />
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </>
  );
}
