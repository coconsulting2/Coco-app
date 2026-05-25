/**
 * PolicyExceptionModal — captura justificación obligatoria (>=10 chars) y crea
 * la PolicyException PENDING (M2-006 RF-45).
 *
 * Sin `apiRequest`/`fetch('/api/...')`: usa `useFetcher` y envía un intent
 * `policy-exception:create` con el payload a la `action` de la ruta anfitriona
 * (prop opcional `action` para apuntar a otra ruta; por defecto submit a la
 * ruta actual). El loader/action de la página debe manejar este intent vía el
 * use-case `createException` del slice policies. `onCreated` se dispara cuando
 * la action responde `{ ok: true, exceptionId }`.
 */
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFetcher } from "react-router";
import Button from "~/shared/ui/Button";
import Modal from "~/shared/ui/Modal";

const schema = z.object({
  justification: z.string().trim().min(10, "Mínimo 10 caracteres"),
});
type FormData = z.infer<typeof schema>;

type ExceptionActionResult =
  | { ok: true; exceptionId: number }
  | { ok: false; error: string };

export interface PolicyExceptionModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (exception: { exceptionId: number }) => void;
  requestId: number;
  receiptId?: number;
  policyId?: number | null;
  capId?: number | null;
  amountClaimed: number;
  amountAllowed?: number | null;
  excessAmount: number;
  /** Ruta destino del submit; por defecto la ruta actual (action del route). */
  action?: string;
}

export default function PolicyExceptionModal(props: PolicyExceptionModalProps) {
  const fetcher = useFetcher<ExceptionActionResult>();
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { justification: "" },
  });

  // Ref con el último handler para reaccionar al resultado de la action sin
  // re-suscribir el efecto a `props`/`form` en cada render.
  const onResultRef = useRef<(result: ExceptionActionResult) => void>(() => {});
  onResultRef.current = (result: ExceptionActionResult) => {
    if (result.ok) {
      form.reset();
      props.onCreated?.({ exceptionId: result.exceptionId });
      props.onClose();
    } else {
      form.setError("justification", { message: result.error });
    }
  };

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    onResultRef.current(fetcher.data);
  }, [fetcher.state, fetcher.data]);

  if (!props.open) return null;

  function onSubmit(values: FormData) {
    const fd = new FormData();
    fd.set("intent", "policy-exception:create");
    fd.set(
      "payload",
      JSON.stringify({
        requestId: props.requestId,
        receiptId: props.receiptId ?? null,
        policyId: props.policyId ?? null,
        capId: props.capId ?? null,
        amountClaimed: props.amountClaimed,
        amountAllowed: props.amountAllowed ?? null,
        excessAmount: props.excessAmount,
        justification: values.justification,
      }),
    );
    fetcher.submit(fd, props.action ? { method: "post", action: props.action } : { method: "post" });
  }

  const submitting = fetcher.state !== "idle" || form.formState.isSubmitting;

  return (
    <Modal
      title="Justificar excedente de política"
      message={`Este gasto excede la política por $${props.excessAmount.toFixed(2)}. Describe el motivo (mínimo 10 caracteres).`}
      show={props.open}
      onClose={props.onClose}
    >
      <form onSubmit={form.handleSubmit(onSubmit)} style={{ display: "grid", gap: "0.75rem" }}>
        <p>Tu aprobador verá esta justificación al revisar.</p>
        <textarea aria-label="Justificación" rows={5} {...form.register("justification")} placeholder="Ejemplo: único hotel disponible cerca del congreso." />
        {form.formState.errors.justification && (
          <small style={{ color: "#B91C1C" }}>{form.formState.errors.justification.message}</small>
        )}
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
          <Button variant="border" color="primary" onClick={props.onClose}>Cancelar</Button>
          <Button type="submit" variant="filled" color="accent" disabled={submitting}>
            {submitting ? "Enviando..." : "Enviar justificación"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
