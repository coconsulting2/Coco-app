/**
 * RolesAdmin — CRUD de roles y permisos por organización.
 * Prop-driven: recibe los roles iniciales y el catálogo de permisos por props
 * (precargados en el loader de `routes/_app/admin/roles`) y muta vía `useFetcher`
 * contra la `action` de esa misma ruta (intents create/update/delete que invocan
 * los use-cases hex del slice identity). Cero `apiRequest`/fetch a `/api/*`.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useFetcher } from "react-router";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Button from "~/shared/ui/Button";
import Modal from "~/shared/ui/Modal";
import Toast from "~/shared/ui/Toast";
import {
  ADMIN_PERMISSION_CODE,
  ALL_PERMISSION_CODES,
  PERMISSIONS_CATALOG,
} from "~/shared/config/permissionsCatalog";
import type { PermissionModule } from "~/shared/config/permissionsCatalog";
import type { Role } from "~/shared/types/Role";

type ApiPermissionRow = {
  code: string;
  resource: string;
  description?: string | null;
};

/** Resultado tipado de la `action` de `routes/_app/admin/roles`. */
type RolesActionResult =
  | { ok: true; intent: "create" | "update"; role: Role }
  | { ok: true; intent: "delete"; roleId: number }
  | { ok: false; error: string };

function buildModulesFromApi(rows: ApiPermissionRow[]): PermissionModule[] {
  if (!rows.length) return PERMISSIONS_CATALOG;
  const by = new Map<string, ApiPermissionRow[]>();
  for (const p of rows) {
    const k = p.resource?.trim() || "other";
    const list = by.get(k) ?? [];
    list.push(p);
    by.set(k, list);
  }
  return [...by.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([resource, perms]) => ({
      key: resource,
      label: resource,
      permissions: [...perms]
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((p) => ({
          code: p.code,
          label: (p.description && p.description.trim()) || p.code,
        })),
    }));
}

const roleSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "El nombre debe tener al menos 2 caracteres")
      .max(40, "Máximo 40 caracteres (límite de la base de datos)"),
    permissions: z.array(z.string()),
    max_authorization_amount: z.union([
      z.number().min(0, "No puede ser negativo"),
      z.literal(""),
    ]),
    expiration_date: z.string(),
    is_admin: z.boolean(),
  })
  .refine((data) => !data.is_admin || data.permissions.includes(ADMIN_PERMISSION_CODE), {
    message: "Un rol admin debe incluir el permiso «Gestionar roles y permisos» (role:manage_permissions)",
    path: ["permissions"],
  });

type RoleFormValues = z.infer<typeof roleSchema>;

type Dialog =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; role: Role }
  | { kind: "delete"; role: Role };

interface RolesAdminProps {
  initialData?: Role[];
  /** Catálogo RBAC para los checkboxes, precargado por el loader. */
  permissionRows?: ApiPermissionRow[];
  /** Token CSRF emitido por el loader; requerido por la `action`. */
  csrfToken?: string;
}

const defaultFormValues: RoleFormValues = {
  name: "",
  permissions: [],
  max_authorization_amount: "",
  expiration_date: "",
  is_admin: false,
};

export default function RolesAdmin({
  initialData,
  permissionRows,
  csrfToken,
}: RolesAdminProps) {
  const fetcher = useFetcher<RolesActionResult>();
  const submitting = fetcher.state !== "idle";
  const pendingIntent = useRef<{ kind: "create" | "update" | "delete"; roleId?: number; name?: string } | null>(null);

  const [roles, setRoles] = useState<Role[]>(() => initialData ?? []);
  const [permissionModules] = useState<PermissionModule[]>(() =>
    permissionRows && permissionRows.length
      ? buildModulesFromApi(permissionRows)
      : PERMISSIONS_CATALOG,
  );
  const [dialog, setDialog] = useState<Dialog>({ kind: "closed" });
  const toastSeq = useRef(0);
  const [toast, setToast] = useState<{
    id: number;
    message: string;
    type: "success" | "error" | "warning";
  } | null>(null);

  const showToast = (
    message: string,
    type: "success" | "error" | "warning",
  ) => {
    toastSeq.current += 1;
    setToast({ id: toastSeq.current, message, type });
  };

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: defaultFormValues,
  });

  const selectedPermissions = watch("permissions") ?? [];
  const isAdminWatched = watch("is_admin");

  const allPermissionCodes = useMemo(() => {
    const codes = permissionModules.flatMap((m) => m.permissions.map((p) => p.code));
    return codes.length ? codes : ALL_PERMISSION_CODES;
  }, [permissionModules]);

  // Reconcilia el estado local con el resultado de la action (useFetcher).
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    const data = fetcher.data;
    const intent = pendingIntent.current;
    pendingIntent.current = null;

    const pushToast = (
      message: string,
      type: "success" | "error" | "warning",
    ) => {
      toastSeq.current += 1;
      setToast({ id: toastSeq.current, message, type });
    };

    if (data.ok === false) {
      pushToast(data.error, "error");
      return;
    }

    if (data.intent === "create") {
      setRoles((prev) => [...prev, data.role]);
      pushToast("Rol creado correctamente", "success");
      setDialog({ kind: "closed" });
    } else if (data.intent === "update") {
      setRoles((prev) => prev.map((r) => (r.role_id === data.role.role_id ? data.role : r)));
      pushToast("Rol actualizado", "success");
      setDialog({ kind: "closed" });
    } else if (data.intent === "delete") {
      setRoles((prev) => prev.filter((r) => r.role_id !== data.roleId));
      pushToast(`Rol "${intent?.name ?? ""}" eliminado`.trim(), "success");
      setDialog({ kind: "closed" });
    }
  }, [fetcher.state, fetcher.data]);

  const adminCount = useMemo(
    () => roles.filter((r) => r.is_admin).length,
    [roles]
  );

  const editingSystem = dialog.kind === "edit" && !!dialog.role.is_system;

  const openCreate = () => {
    reset(defaultFormValues);
    setDialog({ kind: "create" });
  };

  const openEdit = (role: Role) => {
    reset({
      name: role.name,
      permissions: [...role.permissions],
      max_authorization_amount:
        role.max_authorization_amount ?? ("" as const),
      expiration_date: role.expiration_date ?? "",
      is_admin: role.is_admin,
    });
    setDialog({ kind: "edit", role });
  };

  const closeDialog = () => {
    setDialog({ kind: "closed" });
  };

  const togglePermission = (code: string) => {
    if (editingSystem) return;
    const current = selectedPermissions;
    const next = current.includes(code)
      ? current.filter((c) => c !== code)
      : [...current, code];
    setValue("permissions", next, { shouldValidate: true, shouldDirty: true });
  };

  const toggleModule = (moduleCodes: string[]) => {
    if (editingSystem) return;
    const current = new Set(selectedPermissions);
    const allSelected = moduleCodes.every((c) => current.has(c));
    if (allSelected) {
      moduleCodes.forEach((c) => current.delete(c));
    } else {
      moduleCodes.forEach((c) => current.add(c));
    }
    setValue("permissions", Array.from(current), {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  const submitIntent = (
    intent: "create" | "update" | "delete",
    fields: Record<string, string>,
    meta: { roleId?: number; name?: string },
  ) => {
    pendingIntent.current = { kind: intent, ...meta };
    fetcher.submit(
      { _intent: intent, _csrf: csrfToken ?? "", ...fields },
      { method: "post" },
    );
  };

  const onSubmit = (values: RoleFormValues) => {
    const amount =
      values.max_authorization_amount === ""
        ? ""
        : String(values.max_authorization_amount);
    const expiration =
      values.expiration_date && values.expiration_date.trim()
        ? values.expiration_date
        : "";

    if (dialog.kind === "edit" && dialog.role.is_system) {
      // Roles de sistema: solo se envía el monto máximo.
      submitIntent(
        "update",
        {
          role_id: String(dialog.role.role_id),
          max_authorization_amount: amount,
        },
        { roleId: dialog.role.role_id, name: dialog.role.name },
      );
      return;
    }

    if (dialog.kind === "edit" && dialog.role.is_admin && !values.is_admin && adminCount <= 1) {
      showToast("No puedes quitar el último rol administrador del sistema.", "error");
      return;
    }

    const baseFields: Record<string, string> = {
      name: values.name,
      permissions: JSON.stringify(values.permissions),
      max_authorization_amount: amount,
      expiration_date: expiration,
      is_admin: values.is_admin ? "true" : "false",
    };

    if (dialog.kind === "create") {
      submitIntent("create", baseFields, {});
    } else if (dialog.kind === "edit") {
      submitIntent(
        "update",
        { role_id: String(dialog.role.role_id), ...baseFields },
        { roleId: dialog.role.role_id, name: dialog.role.name },
      );
    }
  };

  const handleDelete = () => {
    if (dialog.kind !== "delete") return;
    const role = dialog.role;

    if (role.is_system) {
      showToast(
        "No se pueden eliminar roles de sistema (N1, Solicitante, Administrador, etc.).",
        "error",
      );
      closeDialog();
      return;
    }

    if (role.is_admin && adminCount <= 1) {
      showToast("No puedes eliminar el último rol administrador del sistema.", "error");
      closeDialog();
      return;
    }

    submitIntent(
      "delete",
      { role_id: String(role.role_id) },
      { roleId: role.role_id, name: role.name },
    );
  };

  const dialogOpen = dialog.kind !== "closed";
  const isFormDialog = dialog.kind === "create" || dialog.kind === "edit";
  const editingRole = dialog.kind === "edit" ? dialog.role : null;
  const deletingRole = dialog.kind === "delete" ? dialog.role : null;
  const deletingHasUsers = !!deletingRole && deletingRole.active_users_count > 0;
  const deletingIsLastAdmin =
    !!deletingRole && deletingRole.is_admin && adminCount <= 1;
  const deletingIsSystem = !!deletingRole?.is_system;

  const dialogTitle =
    dialog.kind === "create"
      ? "Nuevo rol"
      : dialog.kind === "edit"
      ? `Editar rol: ${dialog.role.name}`
      : dialog.kind === "delete"
      ? "Eliminar rol"
      : "";

  const deleteMessage = deletingRole
    ? deletingIsSystem
      ? `El rol "${deletingRole.name}" es de sistema y no se puede eliminar.`
      : deletingIsLastAdmin
      ? `No se puede eliminar "${deletingRole.name}" porque es el último rol administrador del sistema.`
      : deletingHasUsers
      ? `El rol "${deletingRole.name}" tiene ${deletingRole.active_users_count} usuario${
          deletingRole.active_users_count === 1 ? "" : "s"
        } activo${
          deletingRole.active_users_count === 1 ? "" : "s"
        }. Reasígnalos antes de eliminar el rol.`
      : `¿Confirmas eliminar el rol "${deletingRole.name}"? Esta acción no se puede deshacer.`
    : "";

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <p className="text-sm text-[var(--color-ink-muted)]">
          {roles.length} {roles.length === 1 ? "rol registrado" : "roles registrados"} ·
          {" "}
          {adminCount} administrador{adminCount === 1 ? "" : "es"}
        </p>
        <Button type="button" variant="filled" color="primary" onClick={openCreate}>
          + Nuevo rol
        </Button>
      </div>

      <section className="card-editorial overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-[var(--color-neutral-200)]">
                <th className="px-6 py-3 text-left eyebrow">Rol</th>
                <th className="px-6 py-3 text-left eyebrow hidden md:table-cell">
                  Permisos
                </th>
                <th className="px-6 py-3 text-left eyebrow hidden sm:table-cell">
                  Monto máx.
                </th>
                <th className="px-6 py-3 text-left eyebrow hidden lg:table-cell">
                  Usuarios
                </th>
                <th className="px-6 py-3 text-right eyebrow">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {roles.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center text-sm text-[var(--color-ink-muted)]"
                  >
                    No hay roles registrados.
                  </td>
                </tr>
              ) : (
                roles.map((role, idx) => {
                  const isLast = idx === roles.length - 1;
                  return (
                    <tr
                      key={role.role_id}
                      className={`${
                        !isLast ? "border-b border-[var(--color-neutral-200)]" : ""
                      } hover:bg-[var(--color-surface-secondary)] transition-colors`}
                    >
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[var(--color-ink)]">
                            {role.name}
                          </span>
                          {role.is_admin && (
                            <span className="status-pill bg-primary-50 text-primary-500">
                              Admin
                            </span>
                          )}
                          {role.is_system && (
                            <span className="status-pill bg-[var(--color-neutral-200)] text-[var(--color-ink-secondary)]">
                              Sistema
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--color-ink-muted)] hidden md:table-cell tabular-nums">
                        {role.permissions.length} / {allPermissionCodes.length}
                      </td>
                      <td className="px-6 py-4 text-sm hidden sm:table-cell money-display">
                        {role.max_authorization_amount == null
                          ? "—"
                          : new Intl.NumberFormat("es-MX", {
                              style: "currency",
                              currency: "MXN",
                              maximumFractionDigits: 0,
                            }).format(role.max_authorization_amount)}
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--color-ink-muted)] hidden lg:table-cell tabular-nums">
                        {role.active_users_count}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => openEdit(role)}
                            className="text-sm text-primary-500 hover:text-primary-400 transition-colors font-medium cursor-pointer"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => setDialog({ kind: "delete", role })}
                            disabled={role.is_system}
                            className={`text-sm font-medium transition-colors ${
                              role.is_system
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
            ? handleSubmit(onSubmit)
            : deletingIsLastAdmin || deletingIsSystem
            ? undefined
            : handleDelete
        }
        confirmLabel={
          submitting
            ? "Guardando..."
            : dialog.kind === "delete"
            ? deletingIsLastAdmin || deletingIsSystem
              ? "Cerrar"
              : "Eliminar"
            : dialog.kind === "edit"
            ? "Actualizar"
            : "Crear rol"
        }
        cancelLabel={dialog.kind === "delete" && (deletingIsLastAdmin || deletingIsSystem) ? "Cerrar" : "Cancelar"}
      >
        {isFormDialog && (
          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-[var(--color-ink-secondary)]">
                Nombre del rol <span className="text-accent-400">*</span>
              </label>
              <input
                type="text"
                {...register("name")}
                disabled={editingSystem}
                placeholder="Ej: Autorizador regional, N4, Director de área"
                className={`w-full border rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors ${
                  errors.name
                    ? "border-accent-400"
                    : "border-[var(--color-neutral-300)]"
                }`}
                autoFocus
              />
              {errors.name && (
                <p className="text-accent-400 text-xs mt-1">
                  {errors.name.message}
                </p>
              )}
              {editingSystem && (
                <p className="text-xs text-[var(--color-ink-muted)] mt-1">
                  Rol de catálogo de la organización: solo puedes cambiar el monto máximo de
                  autorización; nombre y permisos vienen de grupos predefinidos.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-[var(--color-ink-secondary)]">
                  Monto máximo de autorización{" "}
                  <span className="text-[var(--color-ink-muted)]">(MXN)</span>
                </label>
                <Controller
                  control={control}
                  name="max_authorization_amount"
                  render={({ field }) => (
                    <input
                      type="number"
                      min={0}
                      step="100"
                      placeholder="0 = no autoriza"
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === "" ? "" : Number(e.target.value)
                        )
                      }
                      className={`w-full border rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors ${
                        errors.max_authorization_amount
                          ? "border-accent-400"
                          : "border-[var(--color-neutral-300)]"
                      }`}
                    />
                  )}
                />
                {errors.max_authorization_amount && (
                  <p className="text-accent-400 text-xs mt-1">
                    {errors.max_authorization_amount.message as string}
                  </p>
                )}
                <p className="text-xs text-[var(--color-ink-muted)] mt-1">
                  Déjalo vacío para autorización ilimitada.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-[var(--color-ink-secondary)]">
                  Fecha de expiración{" "}
                  <span className="text-[var(--color-ink-muted)]">(opcional)</span>
                </label>
                <input
                  type="date"
                  disabled={editingSystem}
                  {...register("expiration_date")}
                  className={`w-full border rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors ${
                    errors.expiration_date
                      ? "border-accent-400"
                      : "border-[var(--color-neutral-300)]"
                  }`}
                />
                {errors.expiration_date && (
                  <p className="text-accent-400 text-xs mt-1">
                    {errors.expiration_date.message as string}
                  </p>
                )}
              </div>
            </div>

            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                disabled={editingSystem || (!!editingRole?.is_admin && adminCount <= 1)}
                {...register("is_admin")}
                className="mt-1 accent-[var(--color-primary-500,#3D4A2A)]"
              />
              <span className="text-sm text-[var(--color-ink-secondary)]">
                Este rol es administrador del sistema.
                {editingRole?.is_admin && adminCount <= 1 && (
                  <span className="block text-xs text-accent-400 mt-0.5">
                    No puedes quitar este flag: es el único rol admin del sistema.
                  </span>
                )}
              </span>
            </label>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-[var(--color-ink-secondary)]">
                  Permisos{" "}
                  <span className="text-[var(--color-ink-muted)]">
                    ({selectedPermissions.length}/{allPermissionCodes.length})
                  </span>
                </label>
                {errors.permissions && typeof errors.permissions.message === "string" && (
                  <p className="text-accent-400 text-xs">
                    {errors.permissions.message}
                  </p>
                )}
              </div>

              <div className="border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] divide-y divide-[var(--color-neutral-200)] max-h-72 overflow-y-auto">
                {permissionModules.map((module) => {
                  const moduleCodes = module.permissions.map((p) => p.code);
                  const selectedInModule = moduleCodes.filter((c) =>
                    selectedPermissions.includes(c)
                  ).length;
                  const allSelected = selectedInModule === moduleCodes.length;

                  return (
                    <div key={module.key} className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="eyebrow">{module.label}</p>
                          <p className="text-xs text-[var(--color-ink-muted)] tabular-nums">
                            {selectedInModule}/{moduleCodes.length}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={editingSystem}
                          onClick={() => toggleModule(moduleCodes)}
                          className="text-xs text-primary-500 hover:text-primary-400 font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {allSelected ? "Quitar todos" : "Seleccionar todos"}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {module.permissions.map((perm) => {
                          const checked = selectedPermissions.includes(perm.code);
                          const isAdminCode = perm.code === ADMIN_PERMISSION_CODE;
                          return (
                            <label
                              key={perm.code}
                              className="flex items-start gap-2 text-sm cursor-pointer hover:bg-[var(--color-surface-secondary)] rounded px-1.5 py-1"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePermission(perm.code)}
                                disabled={editingSystem || (isAdminWatched && isAdminCode)}
                                className="mt-1 accent-[var(--color-primary-500,#3D4A2A)]"
                              />
                              <span className="text-[var(--color-ink)]">
                                {perm.label}
                                {isAdminCode && isAdminWatched && (
                                  <span className="block text-xs text-[var(--color-ink-muted)]">
                                    Requerido para roles admin
                                  </span>
                                )}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </form>
        )}

        {dialog.kind === "delete" && deletingHasUsers && !deletingIsLastAdmin && !deletingIsSystem && (
          <div className="border-l-4 border-warning-400 bg-warning-50 p-3 rounded-[var(--radius-md)] text-sm text-warning-500">
            ⚠ Este rol tiene usuarios activos. Deberás reasignarles un rol antes
            de que puedan iniciar sesión de nuevo.
          </div>
        )}
      </Modal>

      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.type === "success" ? 3000 : 5000}
        />
      )}
    </div>
  );
}
