/**
 * ExpensePoliciesAdmin — CRUD de políticas de viáticos (M2-006 RF-42, RF-43, RF-46).
 *
 * Prop-driven: recibe `policies` y `categories` del loader de
 * `routes/_app/admin/expense-policies.tsx`. Las mutaciones se envían vía
 * `useFetcher` contra la `action` de la ruta (intents create/update/delete).
 * Sin `apiRequest`/`fetch('/api/...')`/`token`. Tras un submit OK, RR7
 * revalida el loader y refresca `policies` por prop.
 */
import { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFetcher } from "react-router";
import Button from "~/shared/ui/Button";
import Modal from "~/shared/ui/Modal";
import Toast from "~/shared/ui/Toast";

const VALID_SCOPES = ["nacional", "internacional", "any"] as const;
const VALID_CAP_UNITS = ["per_night", "per_trip", "per_day", "per_event"] as const;

const policySchema = z.object({
  name: z.string().trim().min(1, "Requerido").max(120, "Máximo 120 caracteres"),
  categoryId: z.union([z.coerce.number().int().positive(), z.literal("")]).optional(),
  destinationScope: z.enum(VALID_SCOPES).default("any"),
  costsCenter: z.string().trim().max(20).optional().nullable(),
  dailyPerDiem: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
  currency: z.string().length(3).default("MXN"),
  validFrom: z.string().min(1, "Requerido"),
  validTo: z.string().optional().nullable(),
  caps: z.array(
    z.object({
      receiptTypeId: z.coerce.number().int().positive(),
      capAmount: z.coerce.number().min(0),
      capUnit: z.enum(VALID_CAP_UNITS),
      currency: z.string().length(3).default("MXN"),
    }),
  ).default([]),
});

type PolicyFormData = z.infer<typeof policySchema>;

interface ExpenseCap {
  capId?: number;
  receiptTypeId: number;
  capAmount: string | number;
  capUnit: string;
  currency: string;
}

export interface PolicyProp {
  policyId: number;
  name: string;
  categoryId: number | null;
  destinationScope: string;
  costsCenter: string | null;
  dailyPerDiem: string | number | null;
  currency: string;
  validFrom: string;
  validTo: string | null;
  active: boolean;
  expenseCaps?: ExpenseCap[];
}

export interface CategoryProp {
  categoryId: number;
  name: string;
  code: string;
}

interface ReceiptType {
  receiptTypeId: number;
  receiptTypeName: string;
}

export interface ExpensePoliciesAdminProps {
  policies: PolicyProp[];
  categories: CategoryProp[];
}

type ActionResult = { ok: true; intent: string } | { ok: false; error: string; code?: string };

const RECEIPT_TYPES_FALLBACK: ReceiptType[] = [
  { receiptTypeId: 1, receiptTypeName: "Hospedaje" },
  { receiptTypeId: 2, receiptTypeName: "Comida" },
  { receiptTypeId: 6, receiptTypeName: "Vuelo" },
];

function asDateStr(v: string | null | undefined): string {
  return (v || "").slice(0, 10);
}

export default function ExpensePoliciesAdmin({ policies, categories }: ExpensePoliciesAdminProps) {
  const [receiptTypes] = useState<ReceiptType[]>(RECEIPT_TYPES_FALLBACK);
  const [editing, setEditing] = useState<PolicyProp | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetcher = useFetcher<ActionResult>();
  const busy = fetcher.state !== "idle";

  const form = useForm<PolicyFormData>({
    resolver: zodResolver(policySchema) as never,
    defaultValues: {
      name: "", destinationScope: "any", currency: "MXN",
      validFrom: "", validTo: "", caps: [], categoryId: "",
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "caps" });

  // Reacciona al resultado de la action: cierra modal en éxito, muestra error.
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok) {
      setModalOpen(false);
      setToast({ message: "Operación completada.", type: "success" });
    } else {
      setToast({ message: fetcher.data.error, type: "error" });
    }
  }, [fetcher.state, fetcher.data]);

  function openCreate() {
    setEditing(null);
    form.reset({
      name: "", destinationScope: "any", currency: "MXN",
      validFrom: new Date().toISOString().slice(0, 10), validTo: "", caps: [], categoryId: "",
    });
    setModalOpen(true);
  }

  function openEdit(p: PolicyProp) {
    setEditing(p);
    form.reset({
      name: p.name,
      categoryId: p.categoryId ?? "",
      destinationScope: (VALID_SCOPES as readonly string[]).includes(p.destinationScope)
        ? (p.destinationScope as PolicyFormData["destinationScope"])
        : "any",
      costsCenter: p.costsCenter || "",
      dailyPerDiem: p.dailyPerDiem == null ? "" : Number(p.dailyPerDiem),
      currency: p.currency || "MXN",
      validFrom: asDateStr(p.validFrom),
      validTo: p.validTo ? asDateStr(p.validTo) : "",
      caps: (p.expenseCaps || []).map((c) => ({
        receiptTypeId: c.receiptTypeId,
        capAmount: Number(c.capAmount),
        capUnit: (VALID_CAP_UNITS as readonly string[]).includes(c.capUnit)
          ? (c.capUnit as PolicyFormData["caps"][number]["capUnit"])
          : "per_event",
        currency: c.currency || "MXN",
      })),
    });
    setModalOpen(true);
  }

  function onSubmit(values: PolicyFormData) {
    const payload = {
      ...values,
      categoryId: values.categoryId === "" ? null : values.categoryId,
      dailyPerDiem: values.dailyPerDiem === "" ? null : values.dailyPerDiem,
      validTo: values.validTo === "" ? null : values.validTo,
      costsCenter: values.costsCenter || null,
    };
    const fd = new FormData();
    fd.set("payload", JSON.stringify(payload));
    if (editing) {
      fd.set("intent", "update");
      fd.set("policyId", String(editing.policyId));
    } else {
      fd.set("intent", "create");
    }
    fetcher.submit(fd, { method: "post" });
  }

  function onDelete(p: PolicyProp) {
    if (!confirm(`¿Desactivar la política "${p.name}"?`)) return;
    const fd = new FormData();
    fd.set("intent", "delete");
    fd.set("policyId", String(p.policyId));
    fetcher.submit(fd, { method: "post" });
  }

  const sorted = useMemo(
    () => [...policies].sort((a, b) => new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime()),
    [policies]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
        <p style={{ margin: 0 }}>{`${policies.length} políticas`}</p>
        <Button variant="filled" color="primary" onClick={openCreate}>+ Nueva política</Button>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th}>Nombre</th>
            <th style={th}>Categoría</th>
            <th style={th}>Destino</th>
            <th style={th}>Centro Costo</th>
            <th style={th}>Vigencia</th>
            <th style={th}>Caps</th>
            <th style={th}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.policyId}>
              <td style={td}>{p.name}</td>
              <td style={td}>{categories.find((c) => c.categoryId === p.categoryId)?.name || "—"}</td>
              <td style={td}>{p.destinationScope}</td>
              <td style={td}>{p.costsCenter || "—"}</td>
              <td style={td}>
                {asDateStr(p.validFrom)}
                {p.validTo ? ` → ${asDateStr(p.validTo)}` : " → ∞"}
              </td>
              <td style={td}>{p.expenseCaps?.length || 0}</td>
              <td style={td}>
                <Button variant="border" color="primary" size="small" onClick={() => openEdit(p)}>Editar</Button>{" "}
                <Button variant="border" color="accent" size="small" onClick={() => onDelete(p)}>Desactivar</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modalOpen && (
        <Modal
          title={editing ? "Editar política" : "Nueva política"}
          message="Configura nombre, vigencia, alcance y topes por tipo de gasto."
          show={modalOpen}
          onClose={() => setModalOpen(false)}
        >
          <form onSubmit={form.handleSubmit(onSubmit)} style={{ display: "grid", gap: "0.75rem" }}>
            <label>
              Nombre
              <input {...form.register("name")} />
              {form.formState.errors.name && <small>{form.formState.errors.name.message}</small>}
            </label>
            <label>
              Categoría de empleado
              <Controller name="categoryId" control={form.control} render={({ field }) => (
                <select
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  value={field.value === undefined || field.value === null ? "" : String(field.value)}
                  onChange={(e) => field.onChange(e.target.value === "" ? "" : Number(e.target.value))}
                >
                  <option value="">—</option>
                  {categories.map((c) => <option key={c.categoryId} value={c.categoryId}>{c.name}</option>)}
                </select>
              )} />
            </label>
            <label>
              Alcance de destino
              <select {...form.register("destinationScope")}>
                {VALID_SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label>Centro de costos<input {...form.register("costsCenter")} maxLength={20} /></label>
            <label>Viático diario (MXN)<input type="number" step="0.01" {...form.register("dailyPerDiem")} /></label>
            <label>Vigencia desde<input type="date" {...form.register("validFrom")} /></label>
            <label>Vigencia hasta<input type="date" {...form.register("validTo")} /></label>

            <fieldset style={{ border: "1px solid #ccc", padding: "0.75rem" }}>
              <legend>Topes por tipo de gasto</legend>
              {fields.map((f, i) => (
                <div key={f.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <select {...form.register(`caps.${i}.receiptTypeId`)}>
                    {receiptTypes.map((rt) => <option key={rt.receiptTypeId} value={rt.receiptTypeId}>{rt.receiptTypeName}</option>)}
                  </select>
                  <input type="number" step="0.01" placeholder="Tope" {...form.register(`caps.${i}.capAmount`)} />
                  <select {...form.register(`caps.${i}.capUnit`)}>
                    {VALID_CAP_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <Button variant="border" color="accent" size="small" onClick={() => remove(i)}>Quitar</Button>
                </div>
              ))}
              <Button variant="border" color="primary" size="small"
                onClick={() => append({ receiptTypeId: receiptTypes[0]?.receiptTypeId || 1, capAmount: 0, capUnit: "per_event", currency: "MXN" })}>
                + Agregar tope
              </Button>
            </fieldset>

            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <Button variant="border" color="primary" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button type="submit" variant="filled" color="primary" disabled={busy}>
                {busy ? "Guardando…" : editing ? "Guardar" : "Crear"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #ddd" };
const td: React.CSSProperties = { padding: "0.5rem", borderBottom: "1px solid #eee" };
