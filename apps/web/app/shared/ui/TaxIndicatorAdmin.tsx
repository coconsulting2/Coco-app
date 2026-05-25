/**
 * TaxIndicatorAdmin — CRUD view for tax indicators (M3-008).
 *
 * Prop-driven: recibe los indicadores iniciales + mapeos (para bloquear el
 * borrado de indicadores en uso) por props (precargados en el loader de
 * `routes/_app/admin/indicadores-impuesto`) y muta vía `useFetcher` contra la
 * `action` de esa misma ruta (intents create/update/delete que invocan los
 * use-cases hex del slice accounts-payable). Cero `apiRequest`/fetch a `/api/*`.
 *
 * Incluye export CSV client-side. Los indicadores referenciados por un
 * ExpenseTypeMapping activo no pueden eliminarse.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFetcher } from "react-router";
import Button from "~/shared/ui/Button";
import Modal from "~/shared/ui/Modal";
import Toast from "~/shared/ui/Toast";
import {
  TAX_INDICATOR_TYPES,
  TAX_INDICATOR_TYPE_LABEL,
  getMappedTaxIndicatorIds,
} from "~/shared/types/AccountingAccount";
import type {
  ExpenseTypeMapping,
  TaxIndicator,
  TaxIndicatorFormErrors,
  TaxIndicatorFormValues,
  TaxIndicatorType,
} from "~/shared/types/AccountingAccount";
import { downloadCsvFromRows } from "~/shared/utils/csvExport";

interface TaxIndicatorAdminProps {
  initialData?: TaxIndicator[];
  initialMappings?: ExpenseTypeMapping[];
  /** Token CSRF emitido por el loader; requerido por la `action`. */
  csrfToken?: string;
}

/** Resultado tipado de la `action` de `routes/_app/admin/indicadores-impuesto`. */
type TaxIndicatorActionResult =
  | { ok: true; intent: "create" | "update"; indicator: TaxIndicator }
  | { ok: true; intent: "delete"; id: number }
  | { ok: false; error: string };

type Dialog =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; indicator: TaxIndicator }
  | { kind: "delete"; indicator: TaxIndicator };

const emptyForm: TaxIndicatorFormValues = {
  key: "",
  description: "",
  percentage: "",
  type: "IVA_TRASLADADO",
};

export default function TaxIndicatorAdmin({
  initialData,
  initialMappings,
  csrfToken,
}: TaxIndicatorAdminProps) {
  const fetcher = useFetcher<TaxIndicatorActionResult>();
  const submitting = fetcher.state !== "idle";

  const [items, setItems] = useState<TaxIndicator[]>(initialData ?? []);
  const [mappings] = useState<ExpenseTypeMapping[]>(initialMappings ?? []);
  const [dialog, setDialog] = useState<Dialog>({ kind: "closed" });
  const [form, setForm] = useState<TaxIndicatorFormValues>(emptyForm);
  const [errors, setErrors] = useState<TaxIndicatorFormErrors>({});
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<
    { message: string; type: "success" | "error" } | null
  >(null);

  // Reconcilia el estado local con el resultado de la action (useFetcher).
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    const data = fetcher.data;

    if (data.ok === false) {
      setToast({ message: data.error, type: "error" });
      return;
    }
    if (data.intent === "create") {
      setItems((prev) => [...prev, data.indicator]);
      setToast({ message: "Indicador creado", type: "success" });
      setDialog({ kind: "closed" });
    } else if (data.intent === "update") {
      setItems((prev) =>
        prev.map((i) =>
          i.tax_indicator_id === data.indicator.tax_indicator_id ? data.indicator : i,
        ),
      );
      setToast({ message: "Indicador actualizado", type: "success" });
      setDialog({ kind: "closed" });
    } else if (data.intent === "delete") {
      setItems((prev) => prev.filter((i) => i.tax_indicator_id !== data.id));
      setToast({ message: "Indicador eliminado", type: "success" });
      setDialog({ kind: "closed" });
    }
  }, [fetcher.state, fetcher.data]);

  const mappedIds = useMemo(
    () => getMappedTaxIndicatorIds(mappings),
    [mappings]
  );

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) =>
        a.key.localeCompare(b.key, "es", { sensitivity: "base" })
      ),
    [items]
  );

  const openCreate = () => {
    setForm(emptyForm);
    setErrors({});
    setDialog({ kind: "create" });
  };

  const openEdit = (indicator: TaxIndicator) => {
    setForm({
      key: indicator.key,
      description: indicator.description,
      percentage: String(indicator.percentage),
      type: indicator.type,
    });
    setErrors({});
    setDialog({ kind: "edit", indicator });
  };

  const closeDialog = () => {
    setDialog({ kind: "closed" });
    setErrors({});
  };

  const validate = useCallback(
    (
      values: TaxIndicatorFormValues,
      editingId?: number
    ): TaxIndicatorFormErrors => {
      const next: TaxIndicatorFormErrors = {};
      const key = values.key.trim();
      const description = values.description.trim();
      const percentageStr = values.percentage.trim();

      if (!key) next.key = "La clave es requerida";
      else if (!/^[A-Za-z0-9_-]{2,20}$/.test(key))
        next.key = "2–20 caracteres: letras, números, guion o guion bajo";
      else if (
        items.some(
          (i) =>
            i.key.toLowerCase() === key.toLowerCase() &&
            i.tax_indicator_id !== editingId
        )
      )
        next.key = "Esta clave ya existe";

      if (!description) next.description = "La descripción es requerida";
      else if (description.length > 120)
        next.description = "Máximo 120 caracteres";

      if (!percentageStr) next.percentage = "El porcentaje es requerido";
      else {
        const num = Number(percentageStr);
        if (Number.isNaN(num)) next.percentage = "Debe ser un número";
        else if (num < 0) next.percentage = "No puede ser negativo";
        else if (num > 100) next.percentage = "Máximo 100";
      }

      if (!TAX_INDICATOR_TYPES.includes(values.type)) next.type = "Tipo inválido";

      return next;
    },
    [items]
  );

  const submitIntent = (
    intent: "create" | "update" | "delete",
    fields: Record<string, string>,
  ) => {
    fetcher.submit(
      { _intent: intent, _csrf: csrfToken ?? "", ...fields },
      { method: "post" },
    );
  };

  const handleSubmit = () => {
    const editingId =
      dialog.kind === "edit" ? dialog.indicator.tax_indicator_id : undefined;
    const nextErrors = validate(form, editingId);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const fields = {
      key: form.key.trim(),
      description: form.description.trim(),
      percentage: String(Number(form.percentage)),
      type: form.type,
    };

    if (dialog.kind === "create") {
      submitIntent("create", fields);
    } else if (dialog.kind === "edit") {
      submitIntent("update", {
        id: String(dialog.indicator.tax_indicator_id),
        ...fields,
      });
    }
  };

  const handleDelete = () => {
    if (dialog.kind !== "delete") return;
    const id = dialog.indicator.tax_indicator_id;

    if (mappedIds.has(id)) {
      setToast({
        message:
          "No se puede eliminar: el indicador está asociado a un tipo de gasto activo.",
        type: "error",
      });
      closeDialog();
      return;
    }
    submitIntent("delete", { id: String(id) });
  };

  const handleExport = () => {
    setExporting(true);
    try {
      downloadCsvFromRows({
        filename: `indicadores-impuesto-${new Date().toISOString().slice(0, 10)}.csv`,
        columns: [
          { key: "key", header: "Clave" },
          { key: "description", header: "Descripción" },
          { key: "percentage", header: "Porcentaje" },
          { key: "type", header: "Tipo" },
          { key: "in_use", header: "En uso" },
        ],
        rows: sortedItems.map((indicator) => ({
          key: indicator.key,
          description: indicator.description,
          percentage: indicator.percentage,
          type: TAX_INDICATOR_TYPE_LABEL[indicator.type],
          in_use: mappedIds.has(indicator.tax_indicator_id) ? "Sí" : "No",
        })),
      });
      setToast({ message: "CSV descargado", type: "success" });
    } catch (err) {
      console.error(err);
      setToast({ message: "No se pudo exportar el CSV", type: "error" });
    } finally {
      setExporting(false);
    }
  };

  const dialogOpen = dialog.kind !== "closed";
  const isFormDialog = dialog.kind === "create" || dialog.kind === "edit";
  const deletingIndicator = dialog.kind === "delete" ? dialog.indicator : null;
  const deletingIsMapped =
    !!deletingIndicator && mappedIds.has(deletingIndicator.tax_indicator_id);

  const dialogTitle =
    dialog.kind === "create"
      ? "Nuevo indicador de impuesto"
      : dialog.kind === "edit"
        ? `Editar indicador: ${dialog.indicator.key}`
        : dialog.kind === "delete"
          ? "Eliminar indicador"
          : "";

  const deleteMessage = deletingIndicator
    ? deletingIsMapped
      ? `No se puede eliminar "${deletingIndicator.key} · ${deletingIndicator.description}" porque está asociado a un tipo de gasto activo. Quita el mapeo primero.`
      : `¿Confirmas eliminar "${deletingIndicator.key} · ${deletingIndicator.description}"? Esta acción no se puede deshacer.`
    : "";

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <p className="text-sm text-[var(--color-ink-muted)]">
          {sortedItems.length}{" "}
          {sortedItems.length === 1
            ? "indicador registrado"
            : "indicadores registrados"}{" "}
          · {mappedIds.size} en uso
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="border"
            color="primary"
            onClick={handleExport}
            disabled={exporting || sortedItems.length === 0}
          >
            {exporting ? "Exportando..." : "Exportar CSV"}
          </Button>
          <Button
            type="button"
            variant="filled"
            color="primary"
            onClick={openCreate}
          >
            + Nuevo indicador
          </Button>
        </div>
      </div>

      <section className="card-editorial overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-[var(--color-neutral-200)]">
                <th className="px-6 py-3 text-left eyebrow">Clave</th>
                <th className="px-6 py-3 text-left eyebrow">Descripción</th>
                <th className="px-6 py-3 text-right eyebrow hidden sm:table-cell">
                  Porcentaje
                </th>
                <th className="px-6 py-3 text-left eyebrow hidden md:table-cell">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left eyebrow hidden lg:table-cell">
                  Estado
                </th>
                <th className="px-6 py-3 text-right eyebrow">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-10 text-center text-sm text-[var(--color-ink-muted)]"
                  >
                    No hay indicadores de impuesto registrados.
                  </td>
                </tr>
              ) : (
                sortedItems.map((indicator, idx) => {
                  const isLast = idx === sortedItems.length - 1;
                  const inUse = mappedIds.has(indicator.tax_indicator_id);
                  return (
                    <tr
                      key={indicator.tax_indicator_id}
                      className={`${
                        !isLast
                          ? "border-b border-[var(--color-neutral-200)]"
                          : ""
                      } hover:bg-[var(--color-surface-secondary)] transition-colors`}
                    >
                      <td className="px-6 py-4 text-sm font-medium text-[var(--color-ink)]">
                        {indicator.key}
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--color-ink)]">
                        {indicator.description}
                      </td>
                      <td className="px-6 py-4 text-sm tabular-nums text-right hidden sm:table-cell text-[var(--color-ink)]">
                        {indicator.percentage.toLocaleString("es-MX", {
                          maximumFractionDigits: 3,
                        })}
                        %
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <span className="status-pill bg-[var(--color-surface-secondary)] text-[var(--color-ink-secondary)]">
                          {TAX_INDICATOR_TYPE_LABEL[indicator.type]}
                        </span>
                      </td>
                      <td className="px-6 py-4 hidden lg:table-cell">
                        {inUse ? (
                          <span className="status-pill bg-primary-50 text-primary-500">
                            En uso
                          </span>
                        ) : (
                          <span className="status-pill bg-[var(--color-surface-secondary)] text-[var(--color-ink-muted)]">
                            Libre
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => openEdit(indicator)}
                            className="text-sm text-primary-500 hover:text-primary-400 transition-colors font-medium cursor-pointer"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDialog({ kind: "delete", indicator })
                            }
                            disabled={inUse}
                            title={
                              inUse
                                ? "El indicador está asociado a un tipo de gasto activo"
                                : undefined
                            }
                            className={`text-sm font-medium transition-colors ${
                              inUse
                                ? "text-[var(--color-ink-muted)] cursor-not-allowed"
                                : "text-accent-400 hover:text-accent-300 cursor-pointer"
                            }`}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        show={dialogOpen}
        title={dialogTitle}
        message={dialog.kind === "delete" ? deleteMessage : ""}
        type={dialog.kind === "delete" ? "warning" : "confirm"}
        onClose={closeDialog}
        onConfirm={
          isFormDialog
            ? handleSubmit
            : deletingIsMapped
              ? undefined
              : handleDelete
        }
        confirmLabel={
          submitting
            ? "Guardando..."
            : dialog.kind === "delete"
              ? "Eliminar"
              : dialog.kind === "edit"
                ? "Actualizar"
                : "Crear"
        }
        cancelLabel={
          dialog.kind === "delete" && deletingIsMapped ? "Cerrar" : "Cancelar"
        }
      >
        {isFormDialog && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-[var(--color-ink-secondary)]">
                Clave <span className="text-accent-400">*</span>
              </label>
              <input
                type="text"
                value={form.key}
                onChange={(e) =>
                  setForm((f) => ({ ...f, key: e.target.value }))
                }
                className={`w-full border rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors ${
                  errors.key
                    ? "border-accent-400"
                    : "border-[var(--color-neutral-300)]"
                }`}
                placeholder="IVA16"
                autoFocus
              />
              {errors.key && (
                <p className="text-accent-400 text-xs mt-1">{errors.key}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-[var(--color-ink-secondary)]">
                Descripción <span className="text-accent-400">*</span>
              </label>
              <input
                type="text"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                className={`w-full border rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors ${
                  errors.description
                    ? "border-accent-400"
                    : "border-[var(--color-neutral-300)]"
                }`}
                placeholder="IVA 16% acreditable"
              />
              {errors.description && (
                <p className="text-accent-400 text-xs mt-1">{errors.description}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-[var(--color-ink-secondary)]">
                  Porcentaje <span className="text-accent-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={form.percentage}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, percentage: e.target.value }))
                    }
                    className={`w-full border rounded-[var(--radius-md)] pl-3 pr-9 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors tabular-nums ${
                      errors.percentage
                        ? "border-accent-400"
                        : "border-[var(--color-neutral-300)]"
                    }`}
                    placeholder="16"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-ink-muted)] pointer-events-none">
                    %
                  </span>
                </div>
                {errors.percentage && (
                  <p className="text-accent-400 text-xs mt-1">{errors.percentage}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-[var(--color-ink-secondary)]">
                  Tipo <span className="text-accent-400">*</span>
                </label>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      type: e.target.value as TaxIndicatorType,
                    }))
                  }
                  className={`w-full border rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors ${
                    errors.type
                      ? "border-accent-400"
                      : "border-[var(--color-neutral-300)]"
                  }`}
                >
                  {TAX_INDICATOR_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {TAX_INDICATOR_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
                {errors.type && (
                  <p className="text-accent-400 text-xs mt-1">{errors.type}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {toast && (
        <Toast
          key={toast.message + toast.type + Date.now()}
          message={toast.message}
          type={toast.type}
          duration={toast.type === "success" ? 3000 : 5000}
        />
      )}
    </div>
  );
}
