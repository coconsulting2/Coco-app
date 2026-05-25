/**
 * EmployeeCategoriesAdmin — CRUD de categorías de empleado (M2-006).
 *
 * Prop-driven: recibe `categories` del loader de
 * `routes/_app/admin/employee-categories.tsx`. Las mutaciones se envían vía
 * `useFetcher` contra la `action` de la ruta (intents create/update/delete).
 * Sin `apiRequest`/`fetch('/api/...')`/`token`.
 */
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFetcher } from "react-router";
import Button from "~/shared/ui/Button";
import Modal from "~/shared/ui/Modal";
import Toast from "~/shared/ui/Toast";

const categorySchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(254).optional().nullable(),
});
type CategoryFormData = z.infer<typeof categorySchema>;

export interface CategoryRow {
  categoryId: number;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
}

export interface EmployeeCategoriesAdminProps {
  categories: CategoryRow[];
}

type ActionResult = { ok: true; intent: string } | { ok: false; error: string; code?: string };

export default function EmployeeCategoriesAdmin({ categories }: EmployeeCategoriesAdminProps) {
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetcher = useFetcher<ActionResult>();
  const busy = fetcher.state !== "idle";

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: { code: "", name: "", description: "" },
  });

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
    form.reset({ code: "", name: "", description: "" });
    setModalOpen(true);
  }
  function openEdit(c: CategoryRow) {
    setEditing(c);
    form.reset({ code: c.code, name: c.name, description: c.description || "" });
    setModalOpen(true);
  }

  function onSubmit(values: CategoryFormData) {
    const fd = new FormData();
    fd.set("payload", JSON.stringify(values));
    if (editing) {
      fd.set("intent", "update");
      fd.set("categoryId", String(editing.categoryId));
    } else {
      fd.set("intent", "create");
    }
    fetcher.submit(fd, { method: "post" });
  }

  function onDelete(c: CategoryRow) {
    if (!confirm(`¿Desactivar la categoría "${c.name}"?`)) return;
    const fd = new FormData();
    fd.set("intent", "delete");
    fd.set("categoryId", String(c.categoryId));
    fetcher.submit(fd, { method: "post" });
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
        <p style={{ margin: 0 }}>{categories.length} categorías</p>
        <Button variant="filled" color="primary" onClick={openCreate}>+ Nueva categoría</Button>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><th style={th}>Código</th><th style={th}>Nombre</th><th style={th}>Descripción</th><th style={th}>Acciones</th></tr></thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.categoryId}>
              <td style={td}>{c.code}</td>
              <td style={td}>{c.name}</td>
              <td style={td}>{c.description || "—"}</td>
              <td style={td}>
                <Button variant="border" color="primary" size="small" onClick={() => openEdit(c)}>Editar</Button>{" "}
                <Button variant="border" color="accent" size="small" onClick={() => onDelete(c)}>Desactivar</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modalOpen && (
        <Modal
          title={editing ? "Editar categoría" : "Nueva categoría"}
          message="Define el código y nombre de la categoría de empleado."
          show={modalOpen}
          onClose={() => setModalOpen(false)}
        >
          <form onSubmit={form.handleSubmit(onSubmit)} style={{ display: "grid", gap: "0.75rem" }}>
            <label>Código<input {...form.register("code")} maxLength={40} />
              {form.formState.errors.code && <small>{form.formState.errors.code.message}</small>}
            </label>
            <label>Nombre<input {...form.register("name")} maxLength={80} />
              {form.formState.errors.name && <small>{form.formState.errors.name.message}</small>}
            </label>
            <label>Descripción<textarea {...form.register("description")} rows={3} maxLength={254} /></label>
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
