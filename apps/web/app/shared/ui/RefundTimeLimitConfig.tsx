/**
 * RefundTimeLimitConfig — formulario para configurar el plazo de comprobación
 * de gastos (M2-006 RF-37). Prop-driven: recibe la config inicial y el token
 * CSRF desde el loader de la route padre (`admin/refund-time-limits`). Persiste
 * vía `useFetcher` (POST al action RR7). Sin `apiRequest`/`fetch('/api/...')`.
 */
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFetcher } from "react-router";
import Button from "~/shared/ui/Button";
import Toast from "~/shared/ui/Toast";

const schema = z.object({
  daysAfterTrip: z.coerce.number().int().min(1).max(365),
  graceDays: z.coerce.number().int().min(0).max(30),
  blockOnExpiry: z.boolean(),
});
type FormData = z.infer<typeof schema>;

export type RefundTimeLimitConfigValues = {
  daysAfterTrip: number;
  graceDays: number;
  blockOnExpiry: boolean;
  active?: boolean;
};

export type RefundTimeLimitActionResult =
  | { ok: true; config: RefundTimeLimitConfigValues }
  | { ok: false; error: string };

type Props = {
  config: RefundTimeLimitConfigValues;
  csrfToken: string;
};

export default function RefundTimeLimitConfig({ config, csrfToken }: Props) {
  const fetcher = useFetcher<RefundTimeLimitActionResult>();
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      daysAfterTrip: config.daysAfterTrip ?? 14,
      graceDays: config.graceDays ?? 0,
      blockOnExpiry: config.blockOnExpiry ?? true,
    },
  });

  useEffect(() => {
    const result = fetcher.data;
    if (!result || fetcher.state !== "idle") return;
    if (result.ok) {
      setToast({ message: "Configuración actualizada.", type: "success" });
      form.reset({
        daysAfterTrip: result.config.daysAfterTrip,
        graceDays: result.config.graceDays,
        blockOnExpiry: result.config.blockOnExpiry,
      });
    } else {
      setToast({ message: result.error || "Error al guardar.", type: "error" });
    }
  }, [fetcher.data, fetcher.state, form]);

  function onSubmit(values: FormData) {
    const payload = new FormData();
    payload.set("_csrf", csrfToken);
    payload.set("daysAfterTrip", String(values.daysAfterTrip));
    payload.set("graceDays", String(values.graceDays));
    payload.set("blockOnExpiry", values.blockOnExpiry ? "true" : "false");
    fetcher.submit(payload, { method: "post" });
  }

  const submitting = fetcher.state !== "idle";

  return (
    <div>
      <form onSubmit={form.handleSubmit(onSubmit)} style={{ display: "grid", gap: "1rem", maxWidth: "30rem" }}>
        <label>
          Días después del fin de viaje
          <input type="number" min={1} max={365} {...form.register("daysAfterTrip")} />
          {form.formState.errors.daysAfterTrip && <small>{form.formState.errors.daysAfterTrip.message}</small>}
        </label>
        <label>
          Días de gracia adicionales
          <input type="number" min={0} max={30} {...form.register("graceDays")} />
          {form.formState.errors.graceDays && <small>{form.formState.errors.graceDays.message}</small>}
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input type="checkbox" {...form.register("blockOnExpiry")} />
          Bloquear automáticamente al vencer plazo
        </label>
        <Button type="submit" variant="filled" color="primary" disabled={submitting}>
          {submitting ? "Guardando…" : "Guardar configuración"}
        </Button>
      </form>
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
