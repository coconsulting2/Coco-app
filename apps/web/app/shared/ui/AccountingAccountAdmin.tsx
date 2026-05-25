/**
 * AccountingAccountAdmin — CRUD view for the accounting catalog (M3-008).
 *
 * Prop-driven: recibe las cuentas iniciales + mapeos (para bloquear el borrado
 * de cuentas en uso) por props (precargadas en el loader de
 * `routes/_app/admin/catalogo-contable`) y muta vía `useFetcher` contra la
 * `action` de esa misma ruta (intents create/update/delete que invocan los
 * use-cases hex del slice accounts-payable). Cero `apiRequest`/fetch a `/api/*`.
 *
 * Incluye export CSV client-side. Las cuentas referenciadas por un
 * ExpenseTypeMapping activo no pueden eliminarse; la UI lo refleja con una
 * acción deshabilitada y un tooltip.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFetcher } from "react-router";
import Button from "~/shared/ui/Button";
import Modal from "~/shared/ui/Modal";
import Toast from "~/shared/ui/Toast";
import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABEL,
  COMMON_CURRENCIES,
  getMappedAccountIds,
} from "~/shared/types/AccountingAccount";
import type {
  AccountingAccount,
  AccountingAccountFormErrors,
  AccountingAccountFormValues,
  AccountingAccountType,
  ExpenseTypeMapping,
} from "~/shared/types/AccountingAccount";
import { downloadCsvFromRows } from "~/shared/utils/csvExport";

interface AccountingAccountAdminProps {
  initialData?: AccountingAccount[];
  initialMappings?: ExpenseTypeMapping[];
  /** Token CSRF emitido por el loader; requerido por la `action`. */
  csrfToken?: string;
}

/** Resultado tipado de la `action` de `routes/_app/admin/catalogo-contable`. */
type AccountingAccountActionResult =
  | { ok: true; intent: "create" | "update"; account: AccountingAccount }
  | { ok: true; intent: "delete"; id: number }
  | { ok: false; error: string };

type Dialog =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; account: AccountingAccount }
  | { kind: "delete"; account: AccountingAccount };

const emptyForm: AccountingAccountFormValues = {
  account_number: "",
  description: "",
  type: "GASTOS",
  currency: "MXN",
};

export default function AccountingAccountAdmin({
  initialData,
  initialMappings,
  csrfToken,
}: AccountingAccountAdminProps) {
  const fetcher = useFetcher<AccountingAccountActionResult>();
  const submitting = fetcher.state !== "idle";
  const pendingIntent = useRef<{ kind: "create" | "update" | "delete" } | null>(null);

  const [items, setItems] = useState<AccountingAccount[]>(initialData ?? []);
  const [mappings] = useState<ExpenseTypeMapping[]>(initialMappings ?? []);
  const [dialog, setDialog] = useState<Dialog>({ kind: "closed" });
  const [form, setForm] = useState<AccountingAccountFormValues>(emptyForm);
  const [errors, setErrors] = useState<AccountingAccountFormErrors>({});
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<
    { message: string; type: "success" | "error" } | null
  >(null);

  // Reconcilia el estado local con el resultado de la action (useFetcher).
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    const data = fetcher.data;
    pendingIntent.current = null;

    if (data.ok === false) {
      setToast({ message: data.error, type: "error" });
      return;
    }
    if (data.intent === "create") {
      setItems((prev) => [...prev, data.account]);
      setToast({ message: "Cuenta contable creada", type: "success" });
      setDialog({ kind: "closed" });
    } else if (data.intent === "update") {
      setItems((prev) =>
        prev.map((i) =>
          i.accounting_account_id === data.account.accounting_account_id
            ? data.account
            : i,
        ),
      );
      setToast({ message: "Cuenta contable actualizada", type: "success" });
      setDialog({ kind: "closed" });
    } else if (data.intent === "delete") {
      setItems((prev) => prev.filter((i) => i.accounting_account_id !== data.id));
      setToast({ message: "Cuenta contable eliminada", type: "success" });
      setDialog({ kind: "closed" });
    }
  }, [fetcher.state, fetcher.data]);

  const mappedIds = useMemo(() => getMappedAccountIds(mappings), [mappings]);

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) =>
        a.account_number.localeCompare(b.account_number, "es", {
          sensitivity: "base",
        })
      ),
    [items]
  );

  const currencyOptions = useMemo(() => {
    const fromItems = new Set(items.map((i) => i.currency).filter(Boolean));
    return Array.from(new Set<string>([...COMMON_CURRENCIES, ...fromItems]));
  }, [items]);

  const openCreate = () => {
    setForm(emptyForm);
    setErrors({});
    setDialog({ kind: "create" });
  };

  const openEdit = (account: AccountingAccount) => {
    setForm({
      account_number: account.account_number,
      description: account.description,
      type: account.type,
      currency: account.currency,
    });
    setErrors({});
    setDialog({ kind: "edit", account });
  };

  const closeDialog = () => {
    setDialog({ kind: "closed" });
    setErrors({});
  };

  const validate = useCallback(
    (
      values: AccountingAccountFormValues,
      editingId?: number
    ): AccountingAccountFormErrors => {
      const next: AccountingAccountFormErrors = {};
      const accountNumber = values.account_number.trim();
      const description = values.description.trim();
      const currency = values.currency.trim().toUpperCase();

      if (!accountNumber) next.account_number = "El número de cuenta es requerido";
      else if (!/^[A-Za-z0-9_-]{3,20}$/.test(accountNumber))
        next.account_number = "3–20 caracteres: letras, números, guion o guion bajo";
      else if (
        items.some(
          (i) =>
            i.account_number.toLowerCase() === accountNumber.toLowerCase() &&
            i.accounting_account_id !== editingId
        )
      )
        next.account_number = "Este número de cuenta ya existe";

      if (!description) next.description = "La descripción es requerida";
      else if (description.length > 120) next.description = "Máximo 120 caracteres";

      if (!ACCOUNT_TYPES.includes(values.type)) next.type = "Tipo inválido";

      if (!currency) next.currency = "La moneda es requerida";
      else if (!/^[A-Z]{3}$/.test(currency))
        next.currency = "Usa el código ISO de 3 letras (ej. MXN, USD)";

      return next;
    },
    [items]
  );

  const submitIntent = (
    intent: "create" | "update" | "delete",
    fields: Record<string, string>,
  ) => {
    pendingIntent.current = { kind: intent };
    fetcher.submit(
      { _intent: intent, _csrf: csrfToken ?? "", ...fields },
      { method: "post" },
    );
  };

  const handleSubmit = () => {
    const editingId =
      dialog.kind === "edit" ? dialog.account.accounting_account_id : undefined;
    const normalized: AccountingAccountFormValues = {
      ...form,
      currency: form.currency.trim().toUpperCase(),
    };
    const nextErrors = validate(normalized, editingId);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const fields = {
      account_number: normalized.account_number.trim(),
      description: normalized.description.trim(),
      type: normalized.type,
      currency: normalized.currency,
    };

    if (dialog.kind === "create") {
      submitIntent("create", fields);
    } else if (dialog.kind === "edit") {
      submitIntent("update", {
        id: String(dialog.account.accounting_account_id),
        ...fields,
      });
    }
  };

  const handleDelete = () => {
    if (dialog.kind !== "delete") return;
    const id = dialog.account.accounting_account_id;

    if (mappedIds.has(id)) {
      setToast({
        message:
          "No se puede eliminar: la cuenta está asociada a un tipo de gasto activo.",
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
        filename: `cuentas-contables-${new Date().toISOString().slice(0, 10)}.csv`,
        columns: [
          { key: "account_number", header: "Número" },
          { key: "description", header: "Descripción" },
          { key: "type", header: "Tipo" },
          { key: "currency", header: "Moneda" },
          { key: "in_use", header: "En uso" },
        ],
        rows: sortedItems.map((account) => ({
          account_number: account.account_number,
          description: account.description,
          type: ACCOUNT_TYPE_LABEL[account.type],
          currency: account.currency,
          in_use: mappedIds.has(account.accounting_account_id) ? "Sí" : "No",
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
  const deletingAccount = dialog.kind === "delete" ? dialog.account : null;
  const deletingIsMapped =
    !!deletingAccount && mappedIds.has(deletingAccount.accounting_account_id);

  const dialogTitle =
    dialog.kind === "create"
      ? "Nueva cuenta contable"
      : dialog.kind === "edit"
        ? `Editar cuenta: ${dialog.account.account_number}`
        : dialog.kind === "delete"
          ? "Eliminar cuenta contable"
          : "";

  const deleteMessage = deletingAccount
    ? deletingIsMapped
      ? `No se puede eliminar "${deletingAccount.account_number} · ${deletingAccount.description}" porque está asociada a un tipo de gasto activo. Quita el mapeo primero.`
      : `¿Confirmas eliminar "${deletingAccount.account_number} · ${deletingAccount.description}"? Esta acción no se puede deshacer.`
    : "";

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <p className="text-sm text-[var(--color-ink-muted)]">
          {sortedItems.length}{" "}
          {sortedItems.length === 1 ? "cuenta registrada" : "cuentas registradas"} ·{" "}
          {mappedIds.size} en uso
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
            + Nueva cuenta
          </Button>
        </div>
      </div>

      <section className="card-editorial overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-[var(--color-neutral-200)]">
                <th className="px-6 py-3 text-left eyebrow">Número</th>
                <th className="px-6 py-3 text-left eyebrow">Descripción</th>
                <th className="px-6 py-3 text-left eyebrow hidden sm:table-cell">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left eyebrow hidden md:table-cell">
                  Moneda
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
                    No hay cuentas contables registradas.
                  </td>
                </tr>
              ) : (
                sortedItems.map((account, idx) => {
                  const isLast = idx === sortedItems.length - 1;
                  const inUse = mappedIds.has(account.accounting_account_id);
                  return (
                    <tr
                      key={account.accounting_account_id}
                      className={`${
                        !isLast
                          ? "border-b border-[var(--color-neutral-200)]"
                          : ""
                      } hover:bg-[var(--color-surface-secondary)] transition-colors`}
                    >
                      <td className="px-6 py-4 text-sm tabular-nums text-[var(--color-ink)] font-medium">
                        {account.account_number}
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--color-ink)]">
                        {account.description}
                      </td>
                      <td className="px-6 py-4 hidden sm:table-cell">
                        <span className="status-pill bg-[var(--color-surface-secondary)] text-[var(--color-ink-secondary)]">
                          {ACCOUNT_TYPE_LABEL[account.type]}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm tabular-nums text-[var(--color-ink-secondary)] hidden md:table-cell">
                        {account.currency}
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
                            onClick={() => openEdit(account)}
                            className="text-sm text-primary-500 hover:text-primary-400 transition-colors font-medium cursor-pointer"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDialog({ kind: "delete", account })
                            }
                            disabled={inUse}
                            title={
                              inUse
                                ? "La cuenta está asociada a un tipo de gasto activo"
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
                Número de cuenta <span className="text-accent-400">*</span>
              </label>
              <input
                type="text"
                value={form.account_number}
                onChange={(e) =>
                  setForm((f) => ({ ...f, account_number: e.target.value }))
                }
                className={`w-full border rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors tabular-nums ${
                  errors.account_number
                    ? "border-accent-400"
                    : "border-[var(--color-neutral-300)]"
                }`}
                placeholder="6100-001"
                autoFocus
              />
              {errors.account_number && (
                <p className="text-accent-400 text-xs mt-1">
                  {errors.account_number}
                </p>
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
                placeholder="Gastos de viaje · Avión"
              />
              {errors.description && (
                <p className="text-accent-400 text-xs mt-1">{errors.description}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-[var(--color-ink-secondary)]">
                  Tipo <span className="text-accent-400">*</span>
                </label>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      type: e.target.value as AccountingAccountType,
                    }))
                  }
                  className={`w-full border rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors ${
                    errors.type
                      ? "border-accent-400"
                      : "border-[var(--color-neutral-300)]"
                  }`}
                >
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {ACCOUNT_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
                {errors.type && (
                  <p className="text-accent-400 text-xs mt-1">{errors.type}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-[var(--color-ink-secondary)]">
                  Moneda <span className="text-accent-400">*</span>
                </label>
                <input
                  type="text"
                  list="aa-currency-options"
                  value={form.currency}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      currency: e.target.value.toUpperCase().slice(0, 3),
                    }))
                  }
                  className={`w-full border rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors uppercase ${
                    errors.currency
                      ? "border-accent-400"
                      : "border-[var(--color-neutral-300)]"
                  }`}
                  placeholder="MXN"
                  maxLength={3}
                />
                <datalist id="aa-currency-options">
                  {currencyOptions.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                {errors.currency && (
                  <p className="text-accent-400 text-xs mt-1">{errors.currency}</p>
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
