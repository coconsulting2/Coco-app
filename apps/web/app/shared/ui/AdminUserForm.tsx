/**
 * AdminUserForm — formulario de alta/edición de usuarios para el panel admin.
 *
 * Prop-driven y sin `apiRequest`: las opciones de rol/departamento llegan por
 * props (precargadas por el loader de la ruta que lo renderiza) y el submit
 * usa `useFetcher` apuntando a las actions RR7 ya existentes de
 * `crear-usuario` / `editar-usuario.$id` (que invocan los use-cases hex del
 * slice identity). No duplica use-cases: consume la API pública del slice vía
 * esas actions.
 */

import React, { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import Button from "~/shared/ui/Button";
import Toast from "~/shared/ui/Toast";

interface FormData {
  role_id: number | "";
  department_id: number | "";
  user_name: string;
  password: string;
  workstation: string;
  email: string;
  phone_number: string;
}

interface FormErrors {
  [key: string]: string;
}

export interface AdminUserFormOption {
  id: number;
  name: string;
}

export interface AdminUserFormUserData {
  user_id: number;
  user_name: string;
  email: string;
  phone_number?: string | null;
  workstation: string;
  role_name?: string;
  department_name?: string;
}

interface AdminUserFormProps {
  mode: "create" | "edit";
  /** Roles del tenant (precargados por el loader). */
  roles: AdminUserFormOption[];
  /** Departamentos del tenant (precargados por el loader). */
  departments: AdminUserFormOption[];
  /** Token CSRF emitido por el loader; requerido por las actions. */
  csrfToken: string;
  /** Datos del usuario a editar (solo `mode==="edit"`). */
  userData?: AdminUserFormUserData;
  redirectTo?: string;
}

type ActionResult = { ok: true } | { ok: false; error: string };

function initialFormData(): FormData {
  return {
    role_id: "",
    department_id: "",
    user_name: "",
    password: "",
    workstation: "",
    email: "",
    phone_number: "",
  };
}

export default function AdminUserForm({
  mode,
  roles,
  departments,
  csrfToken,
  userData,
  redirectTo,
}: AdminUserFormProps) {
  const fetcher = useFetcher<ActionResult>();
  const isSubmitting = fetcher.state !== "idle";

  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (mode === "edit" && userData) {
      setFormData({
        role_id: roles.find((r) => r.name === userData.role_name)?.id ?? "",
        department_id:
          departments.find((d) => d.name === userData.department_name)?.id ?? "",
        user_name: userData.user_name,
        password: "",
        workstation: userData.workstation,
        email: userData.email,
        phone_number: userData.phone_number ?? "",
      });
    } else {
      setFormData(initialFormData());
    }
  }, [mode, userData, roles, departments]);

  // Reacciona al resultado de la action RR7.
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    const data = fetcher.data;
    if (data.ok === false) {
      setToast({ message: data.error, type: "error" });
      return;
    }
    setToast({
      message: `Usuario ${mode === "edit" ? "actualizado" : "creado"} exitosamente`,
      type: "success",
    });
    if (mode === "create") setFormData(initialFormData());
    if (redirectTo) window.location.href = redirectTo;
  }, [fetcher.state, fetcher.data, mode, redirectTo]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.user_name.trim()) {
      newErrors.user_name = "El nombre de usuario es requerido";
    } else if (formData.user_name.includes(" ")) {
      newErrors.user_name = "El nombre de usuario no puede contener espacios";
    }

    if (mode === "create") {
      if (!formData.password.trim()) {
        newErrors.password = "La contraseña es requerida";
      } else if (formData.password.includes(" ")) {
        newErrors.password = "La contraseña no puede contener espacios";
      }
    }

    if (!formData.email.trim()) {
      newErrors.email = "El email es requerido";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "El email debe tener un formato válido";
    }

    if (!formData.workstation.trim()) {
      newErrors.workstation = "La estación de trabajo es requerida";
    }

    if (!formData.role_id) {
      newErrors.role_id = "El rol es requerido";
    }

    if (!formData.department_id) {
      newErrors.department_id = "El departamento es requerido";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "role_id" || name === "department_id"
          ? value === ""
            ? ""
            : parseInt(value, 10)
          : value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      setToast({ message: "Por favor corrige los errores en el formulario", type: "error" });
      return;
    }
    setToast(null);

    const fields: Record<string, string> = {
      _csrf: csrfToken,
      user_name: formData.user_name,
      email: formData.email,
      phone_number: formData.phone_number,
      workstation: formData.workstation,
      role_id: String(formData.role_id),
      department_id: String(formData.department_id),
    };
    if (formData.password) fields.password = formData.password;

    if (mode === "edit") {
      fields._mode = "update";
      fetcher.submit(fields, {
        method: "post",
        action: `/editar-usuario/${userData?.user_id ?? ""}`,
      });
    } else {
      fetcher.submit(fields, { method: "post", action: "/crear-usuario" });
    }
  };

  const handleReset = () => {
    if (mode === "edit") {
      if (redirectTo) window.location.href = redirectTo;
    } else {
      setFormData(initialFormData());
      setErrors({});
      setToast(null);
    }
  };

  const inputClass = (fieldName: string) =>
    `w-full border rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors ${
      errors[fieldName] ? "border-accent-400" : "border-[var(--color-neutral-300)]"
    }`;

  return (
    <div className="card-editorial p-8">
      <div
        className="flex items-center border-l-4 p-4 mb-8 rounded-[var(--radius-md)]"
        style={{ borderColor: "var(--color-ink-muted)", backgroundColor: "var(--color-surface-secondary)" }}
      >
        <p className="text-sm font-medium" style={{ color: "var(--color-ink-secondary)" }}>
          Los campos obligatorios están marcados con un asterisco (*).
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-ink-secondary)" }}>
              Nombre de Usuario <span className="text-accent-400">*</span>
            </label>
            <input
              type="text"
              name="user_name"
              value={formData.user_name}
              onChange={handleInputChange}
              className={inputClass("user_name")}
              placeholder="Ej: juan.perez"
            />
            {errors.user_name && <p className="text-accent-400 text-xs mt-1">{errors.user_name}</p>}
          </div>
          {mode === "create" && (
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-ink-secondary)" }}>
                Contraseña <span className="text-accent-400">*</span>
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className={inputClass("password")}
                placeholder="Contraseña segura"
              />
              {errors.password && <p className="text-accent-400 text-xs mt-1">{errors.password}</p>}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-ink-secondary)" }}>
              Email <span className="text-accent-400">*</span>
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className={inputClass("email")}
              placeholder="usuario@empresa.com"
            />
            {errors.email && <p className="text-accent-400 text-xs mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-ink-secondary)" }}>
              Número de Teléfono <span style={{ color: "var(--color-ink-muted)" }}>(opcional)</span>
            </label>
            <input
              type="tel"
              name="phone_number"
              value={formData.phone_number}
              onChange={handleInputChange}
              className={inputClass("phone_number")}
              placeholder="555-1234"
            />
            {errors.phone_number && <p className="text-accent-400 text-xs mt-1">{errors.phone_number}</p>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-ink-secondary)" }}>
            Estación de Trabajo <span className="text-accent-400">*</span>
          </label>
          <input
            type="text"
            name="workstation"
            value={formData.workstation}
            onChange={handleInputChange}
            className={inputClass("workstation")}
            placeholder="Ej: WS-001"
          />
          {errors.workstation && <p className="text-accent-400 text-xs mt-1">{errors.workstation}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-ink-secondary)" }}>
              Rol <span className="text-accent-400">*</span>
            </label>
            <select
              name="role_id"
              value={formData.role_id}
              onChange={handleInputChange}
              className={inputClass("role_id")}
            >
              <option value="">Seleccionar rol</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            {errors.role_id && <p className="text-accent-400 text-xs mt-1">{errors.role_id}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-ink-secondary)" }}>
              Departamento <span className="text-accent-400">*</span>
            </label>
            <select
              name="department_id"
              value={formData.department_id}
              onChange={handleInputChange}
              className={inputClass("department_id")}
            >
              <option value="">Seleccionar departamento</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
            {errors.department_id && <p className="text-accent-400 text-xs mt-1">{errors.department_id}</p>}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
          <Button type="button" onClick={handleReset} variant="border" color="accent" disabled={isSubmitting}>
            {mode === "edit" ? "Cancelar" : "Limpiar Formulario"}
          </Button>

          <Button type="submit" variant="filled" color="primary" disabled={isSubmitting}>
            {isSubmitting
              ? mode === "edit"
                ? "Actualizando..."
                : "Creando Usuario..."
              : mode === "edit"
              ? "Actualizar Usuario"
              : "Crear Usuario"}
          </Button>
        </div>
      </form>

      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <Toast message={toast.message} type={toast.type} duration={toast.type === "success" ? 4000 : 6000} />
        </div>
      )}
    </div>
  );
}
