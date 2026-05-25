/**
 * ExpenseTypeMappingAdmin — Associates each ReceiptType (Avión, Hotel, …)
 * to a cargo and abono accounting account, plus an optional tax indicator.
 *
 * Prop-driven: recibe mapeos + cuentas + tipos de comprobante + indicadores por
 * props (precargados en el loader de `routes/_app/admin/mapeo-gastos`) y muta
 * vía `useFetcher` contra la `action` de esa misma ruta (intents
 * create/update/delete que invocan los use-cases hex del slice
 * accounts-payable). El form exige que cargo y abono sean cuentas distintas.
 * Cero `apiRequest`/fetch a `/api/*`.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useFetcher } from "react-router";
import Button from "~/shared/ui/Button";
import Modal from "~/shared/ui/Modal";
import Toast from "~/shared/ui/Toast";
import { TAX_INDICATOR_TYPE_LABEL } from "~/shared/types/AccountingAccount";
import type {
  AccountingAccount,
  ExpenseTypeMapping,
  ExpenseTypeMappingFormErrors,
  ExpenseTypeMappingFormValues,
  ReceiptType,
  TaxIndicator,
} from "~/shared/types/AccountingAccount";

interface ExpenseTypeMappingAdminProps {
  initialMappings?: ExpenseTypeMapping[];
  initialAccounts?: AccountingAccount[];
  initialReceiptTypes?: ReceiptType[];
  initialTaxIndicators?: TaxIndicator[];
  /** Token CSRF emitido por el loader; requerido por la `action`. */
  csrfToken?: string;
}

/** Resultado tipado de la `action` de `routes/_app/admin/mapeo-gastos`. */
type ExpenseTypeMappingActionResult =
  | { ok: true; intent: "create" | "update"; mapping: ExpenseTypeMapping }
  | { ok: true; intent: "delete"; id: number }
  | { ok: false; error: string };

type Dialog =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; mapping: ExpenseTypeMapping }
  | { kind: "delete"; mapping: ExpenseTypeMapping };

const emptyForm: ExpenseTypeMappingFormValues = {
  receipt_type_id: null,
  cargo_account_id: null,
  abono_account_id: null,
  tax_indicator_id: null,
};

export default function ExpenseTypeMappingAdmin({
  initialMappings,
  initialAccounts,
  initialReceiptTypes,
  initialTaxIndicators,
  csrfToken,
}: ExpenseTypeMappingAdminProps) {
  const fetcher = useFetcher<ExpenseTypeMappingActionResult>();
  const submitting = fetcher.state !== "idle";

  const [mappings, setMappings] = useState<ExpenseTypeMapping[]>(
    initialMappings ?? []
  );
  const [accounts] = useState<AccountingAccount[]>(initialAccounts ?? []);
  const [receiptTypes] = useState<ReceiptType[]>(initialReceiptTypes ?? []);
  const [taxIndicators] = useState<TaxIndicator[]>(initialTaxIndicators ?? []);
  const [dialog, setDialog] = useState<Dialog>({ kind: "closed" });
  const [form, setForm] = useState<ExpenseTypeMappingFormValues>(emptyForm);
  const [errors, setErrors] = useState<ExpenseTypeMappingFormErrors>({});
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
      setMappings((prev) => [...prev, data.mapping]);
      setToast({ message: "Mapeo creado", type: "success" });
      setDialog({ kind: "closed" });
    } else if (data.intent === "update") {
      setMappings((prev) =>
        prev.map((m) =>
          m.expense_type_mapping_id === data.mapping.expense_type_mapping_id
            ? data.mapping
            : m,
        ),
      );
      setToast({ message: "Mapeo actualizado", type: "success" });
      setDialog({ kind: "closed" });
    } else if (data.intent === "delete") {
      setMappings((prev) =>
        prev.filter((m) => m.expense_type_mapping_id !== data.id),
      );
      setToast({ message: "Mapeo eliminado", type: "success" });
      setDialog({ kind: "closed" });
    }
  }, [fetcher.state, fetcher.data]);

  const cargoAccounts = useMemo(
    () => accounts.filter((a) => a.type === "ANTICIPOS" || a.type === "GASTOS"),
    [accounts]
  );
  const abonoAccounts = useMemo(
    () => accounts.filter((a) => a.type === "ACREEDORES"),
    [accounts]
  );

  const accountById = useCallback(
    (id: number | null) =>
      id == null
        ? null
        : accounts.find((a) => a.accounting_account_id === id) ?? null,
    [accounts]
  );

  const receiptTypeById = useCallback(
    (id: number | null) =>
      id == null
        ? null
        : receiptTypes.find((r) => r.receipt_type_id === id) ?? null,
    [receiptTypes]
  );

  const taxById = useCallback(
    (id: number | null) =>
      id == null
        ? null
        : taxIndicators.find((t) => t.tax_indicator_id === id) ?? null,
    [taxIndicators]
  );

  /**
   * ReceiptTypes not yet mapped — used to constrain the create dropdown
   * so a single ReceiptType cannot be mapped twice.
   */
  const availableReceiptTypes = useMemo(() => {
    const usedIds = new Set(
      mappings
        .filter((m) => m.active !== false)
        .map((m) => m.receipt_type_id)
    );
    return receiptTypes.filter(
      (rt) =>
        !usedIds.has(rt.receipt_type_id) ||
        (dialog.kind === "edit" &&
          dialog.mapping.receipt_type_id === rt.receipt_type_id)
    );
  }, [mappings, receiptTypes, dialog]);

  const openCreate = () => {
    setForm(emptyForm);
    setErrors({});
    setDialog({ kind: "create" });
  };

  const openEdit = (mapping: ExpenseTypeMapping) => {
    setForm({
      receipt_type_id: mapping.receipt_type_id,
      cargo_account_id: mapping.cargo_account_id,
      abono_account_id: mapping.abono_account_id,
      tax_indicator_id: mapping.tax_indicator_id,
    });
    setErrors({});
    setDialog({ kind: "edit", mapping });
  };

  const closeDialog = () => {
    setDialog({ kind: "closed" });
    setErrors({});
  };

  const validate = useCallback(
    (values: ExpenseTypeMappingFormValues): ExpenseTypeMappingFormErrors => {
      const next: ExpenseTypeMappingFormErrors = {};
      if (values.receipt_type_id == null)
        next.receipt_type_id = "Selecciona un tipo de gasto";
      if (values.cargo_account_id == null)
        next.cargo_account_id = "Selecciona la cuenta de cargo";
      if (values.abono_account_id == null)
        next.abono_account_id = "Selecciona la cuenta de abono";
      if (
        values.cargo_account_id != null &&
        values.abono_account_id != null &&
        values.cargo_account_id === values.abono_account_id
      )
        next.abono_account_id = "La cuenta de abono debe ser distinta del cargo";
      return next;
    },
    []
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
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const fields = {
      receipt_type_id: String(form.receipt_type_id),
      cargo_account_id: String(form.cargo_account_id),
      abono_account_id: String(form.abono_account_id),
      tax_indicator_id: form.tax_indicator_id == null ? "" : String(form.tax_indicator_id),
    };

    if (dialog.kind === "create") {
      submitIntent("create", fields);
    } else if (dialog.kind === "edit") {
      submitIntent("update", {
        id: String(dialog.mapping.expense_type_mapping_id),
        ...fields,
      });
    }
  };

  const handleDelete = () => {
    if (dialog.kind !== "delete") return;
    submitIntent("delete", {
      id: String(dialog.mapping.expense_type_mapping_id),
    });
  };

  const dialogOpen = dialog.kind !== "closed";
  const isFormDialog = dialog.kind === "create" || dialog.kind === "edit";
  const deletingMapping = dialog.kind === "delete" ? dialog.mapping : null;
  const deletingReceipt = deletingMapping
    ? receiptTypeById(deletingMapping.receipt_type_id)
    : null;

  const dialogTitle =
    dialog.kind === "create"
      ? "Nuevo mapeo de gasto"
      : dialog.kind === "edit"
        ? "Editar mapeo de gasto"
        : dialog.kind === "delete"
          ? "Eliminar mapeo"
          : "";

  const deleteMessage = deletingMapping
    ? `¿Confirmas eliminar el mapeo para "${
        deletingReceipt?.name ?? "—"
      }"? El tipo de gasto quedará sin cuenta asignada hasta que crees uno nuevo.`
    : "";

  const noReceiptTypesLeft =
    dialog.kind === "create" && availableReceiptTypes.length === 0;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <p className="text-sm text-[var(--color-ink-muted)]">
          {mappings.length}{" "}
          {mappings.length === 1 ? "mapeo registrado" : "mapeos registrados"} ·{" "}
          {Math.max(receiptTypes.length - mappings.length, 0)} sin asignar
        </p>
        <Button
          type="button"
          variant="filled"
          color="primary"
          onClick={openCreate}
          disabled={receiptTypes.length === 0}
        >
          + Nuevo mapeo
        </Button>
      </div>

      <section className="card-editorial overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-[var(--color-neutral-200)]">
                <th className="px-6 py-3 text-left eyebrow">Tipo de gasto</th>
                <th className="px-6 py-3 text-left eyebrow">Cuenta de cargo</th>
                <th className="px-6 py-3 text-left eyebrow">Cuenta de abono</th>
                <th className="px-6 py-3 text-left eyebrow hidden md:table-cell">
                  Impuesto
                </th>
                <th className="px-6 py-3 text-right eyebrow">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {mappings.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center text-sm text-[var(--color-ink-muted)]"
                  >
                    No hay tipos de gasto mapeados aún.
                  </td>
                </tr>
              ) : (
                mappings.map((mapping, idx) => {
                  const isLast = idx === mappings.length - 1;
                  const receipt = receiptTypeById(mapping.receipt_type_id);
                  const cargo = accountById(mapping.cargo_account_id);
                  const abono = accountById(mapping.abono_account_id);
                  const tax = taxById(mapping.tax_indicator_id);
                  return (
                    <tr
                      key={mapping.expense_type_mapping_id}
                      className={`${
                        !isLast
                          ? "border-b border-[var(--color-neutral-200)]"
                          : ""
                      } hover:bg-[var(--color-surface-secondary)] transition-colors`}
                    >
                      <td className="px-6 py-4 text-sm">
                        <span className="font-medium text-[var(--color-ink)]">
                          {receipt?.name ?? "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--color-ink)]">
                        {cargo ? (
                          <span className="inline-flex flex-col">
                            <span className="tabular-nums font-medium">
                              {cargo.account_number}
                            </span>
                            <span className="text-xs text-[var(--color-ink-muted)]">
                              {cargo.description}
                            </span>
                          </span>
                        ) : (
                          <span className="text-[var(--color-ink-muted)]">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--color-ink)]">
                        {abono ? (
                          <span className="inline-flex flex-col">
                            <span className="tabular-nums font-medium">
                              {abono.account_number}
                            </span>
                            <span className="text-xs text-[var(--color-ink-muted)]">
                              {abono.description}
                            </span>
                          </span>
                        ) : (
                          <span className="text-[var(--color-ink-muted)]">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm hidden md:table-cell">
                        {tax ? (
                          <span
                            className="status-pill bg-[var(--color-surface-secondary)] text-[var(--color-ink-secondary)]"
                            title={TAX_INDICATOR_TYPE_LABEL[tax.type]}
                          >
                            {tax.key}
                          </span>
                        ) : (
                          <span className="text-[var(--color-ink-muted)]">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => openEdit(mapping)}
                            className="text-sm text-primary-500 hover:text-primary-400 transition-colors font-medium cursor-pointer"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDialog({ kind: "delete", mapping })
                            }
                            className="text-sm text-accent-400 hover:text-accent-300 transition-colors font-medium cursor-pointer"
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
        onConfirm={isFormDialog ? handleSubmit : handleDelete}
        confirmLabel={
          submitting
            ? "Guardando..."
            : dialog.kind === "delete"
              ? "Eliminar"
              : dialog.kind === "edit"
                ? "Actualizar"
                : "Crear"
        }
        cancelLabel="Cancelar"
      >
        {isFormDialog && (
          <div className="space-y-4">
            {noReceiptTypesLeft && (
              <div className="border-l-4 border-warning-400 bg-warning-50 p-3 rounded-[var(--radius-md)] text-sm text-warning-500">
                Todos los tipos de gasto ya están mapeados. Edita un mapeo
                existente para cambiar sus cuentas.
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1.5 text-[var(--color-ink-secondary)]">
                Tipo de gasto <span className="text-accent-400">*</span>
              </label>
              <select
                value={form.receipt_type_id ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    receipt_type_id:
                      e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                disabled={dialog.kind === "edit"}
                className={`w-full border rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors ${
                  errors.receipt_type_id
                    ? "border-accent-400"
                    : "border-[var(--color-neutral-300)]"
                } ${dialog.kind === "edit" ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <option value="">— Selecciona —</option>
                {availableReceiptTypes.map((rt) => (
                  <option key={rt.receipt_type_id} value={rt.receipt_type_id}>
                    {rt.name}
                  </option>
                ))}
              </select>
              {errors.receipt_type_id && (
                <p className="text-accent-400 text-xs mt-1">
                  {errors.receipt_type_id}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-[var(--color-ink-secondary)]">
                Cuenta de cargo <span className="text-accent-400">*</span>
              </label>
              <select
                value={form.cargo_account_id ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    cargo_account_id:
                      e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                className={`w-full border rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors ${
                  errors.cargo_account_id
                    ? "border-accent-400"
                    : "border-[var(--color-neutral-300)]"
                }`}
              >
                <option value="">— Selecciona —</option>
                {cargoAccounts.map((a) => (
                  <option
                    key={a.accounting_account_id}
                    value={a.accounting_account_id}
                  >
                    {a.account_number} · {a.description}
                  </option>
                ))}
              </select>
              {errors.cargo_account_id && (
                <p className="text-accent-400 text-xs mt-1">
                  {errors.cargo_account_id}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-[var(--color-ink-secondary)]">
                Cuenta de abono <span className="text-accent-400">*</span>
              </label>
              <select
                value={form.abono_account_id ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    abono_account_id:
                      e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                className={`w-full border rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors ${
                  errors.abono_account_id
                    ? "border-accent-400"
                    : "border-[var(--color-neutral-300)]"
                }`}
              >
                <option value="">— Selecciona —</option>
                {abonoAccounts.map((a) => (
                  <option
                    key={a.accounting_account_id}
                    value={a.accounting_account_id}
                  >
                    {a.account_number} · {a.description}
                  </option>
                ))}
              </select>
              {errors.abono_account_id && (
                <p className="text-accent-400 text-xs mt-1">
                  {errors.abono_account_id}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-[var(--color-ink-secondary)]">
                Indicador de impuesto{" "}
                <span className="text-[var(--color-ink-muted)]">(opcional)</span>
              </label>
              <select
                value={form.tax_indicator_id ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    tax_indicator_id:
                      e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                className="w-full border border-[var(--color-neutral-300)] rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors"
              >
                <option value="">— Sin indicador —</option>
                {taxIndicators.map((t) => (
                  <option key={t.tax_indicator_id} value={t.tax_indicator_id}>
                    {t.key} · {t.description} ({t.percentage}%)
                  </option>
                ))}
              </select>
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
