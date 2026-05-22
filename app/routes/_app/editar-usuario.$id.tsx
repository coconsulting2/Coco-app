/**
 * @module editar-usuario.$id
 * @description Editar usuario existente. Loader hidrata datos por DI.
 * Action soporta `mode=update` (updateUserData) y `mode=deactivate`
 * (deactivateUserById). Tras éxito redirige al dashboard.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, redirect, useActionData, useLoaderData } from "react-router";

import { requirePermissions, runInTenant } from "~/platform/session/requireUser.server";
import { assertCsrf, issueCsrfToken } from "~/platform/csrf/csrf.server";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — JS module
import * as adminService from "~/contexts/identity/application/adminService.js";
// @ts-ignore
import * as userService from "~/contexts/identity/application/userService.js";
// @ts-ignore
import { deactivateUser } from "~/contexts/identity/application/adminAccountsService.js";
// @ts-ignore
import {
  listAvailableRoles,
  listAvailableDepartments,
} from "~/contexts/identity/application/lookupsService.js";

export function meta() {
  return [{ title: "Editar usuario — CocoConsulting" }];
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const session = await requirePermissions(request, "user:update");
  const userId = Number(params.id);
  if (!Number.isFinite(userId)) {
    throw new Response("ID inválido", { status: 400 });
  }

  const [user, roles, departments, csrf] = await Promise.all([
    runInTenant(session, async () => userService.getUserById(userId)),
    runInTenant(session, listAvailableRoles),
    runInTenant(session, listAvailableDepartments),
    Promise.resolve(issueCsrfToken(request)),
  ]);

  if (!user) {
    throw new Response("Usuario no encontrado", { status: 404 });
  }

  return new Response(
    JSON.stringify({ user, roles, departments, csrfToken: csrf.token }),
    {
      status: 200,
      headers: { "content-type": "application/json", "set-cookie": csrf.setCookie },
    },
  );
}

type ActionResult = { ok: true } | { ok: false; error: string };

export async function action({ request, params }: ActionFunctionArgs): Promise<Response> {
  const session = await requirePermissions(request, "user:update");
  await assertCsrf(request);

  const userId = Number(params.id);
  if (!Number.isFinite(userId)) {
    return Response.json({ ok: false, error: "ID inválido" }, { status: 400 });
  }

  const form = await request.formData();
  const mode = form.get("_mode")?.toString() ?? "update";

  try {
    if (mode === "deactivate") {
      await runInTenant(session, async () => deactivateUser(userId));
      return redirect("/dashboard?notice=user-deactivated");
    }

    const updateFields: Record<string, unknown> = {};
    for (const key of ["user_name", "email", "phone_number", "workstation", "role_id", "department_id"]) {
      const v = form.get(key);
      if (v != null && String(v) !== "") {
        updateFields[key] = key === "role_id" || key === "department_id" ? Number(v) : String(v);
      }
    }
    const pwd = form.get("password")?.toString();
    if (pwd && pwd.length > 0) updateFields.password = pwd;

    await runInTenant(session, async () => adminService.updateUserData(userId, updateFields));
    return redirect("/dashboard?notice=user-updated");
  } catch (err) {
    const e = err as { message?: string; status?: number };
    return Response.json(
      { ok: false, error: e?.message ?? "Error actualizando usuario" } satisfies ActionResult,
      { status: e?.status ?? 500 },
    );
  }
}

type LoaderData = {
  user: {
    user_id: number;
    user_name: string;
    email: string;
    phone_number: string;
    workstation: string;
    no_empleado: string | null;
    role_name: string;
    department_name: string;
  };
  roles: { id: number; name: string }[];
  departments: { id: number; name: string }[];
  csrfToken: string;
};

export default function EditarUsuarioRoute() {
  const data = useLoaderData() as LoaderData;
  const result = useActionData() as ActionResult | undefined;

  return (
    <section className="max-w-3xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">
          Coco / Administración / Editar
        </p>
        <h1 className="font-serif text-3xl md:text-4xl text-[var(--color-ink)]">
          {data.user.user_name}
        </h1>
        <p className="text-[var(--color-ink-muted)]">
          {data.user.role_name} · {data.user.department_name}
        </p>
      </header>

      <Form method="post" className="space-y-5 bg-white border border-[var(--color-neutral-200,#e5e7eb)] rounded-lg p-6">
        <input type="hidden" name="_csrf" value={data.csrfToken} />
        <input type="hidden" name="_mode" value="update" />

        <Field name="user_name" label="Usuario" defaultValue={data.user.user_name} />
        <Field name="password" label="Nueva contraseña (opcional)" type="password" />
        <Field name="email" label="Email" type="email" defaultValue={data.user.email} />
        <Field name="phone_number" label="Teléfono" defaultValue={data.user.phone_number} />
        <Field name="workstation" label="Puesto" defaultValue={data.user.workstation} />
        <SelectField name="role_id" label="Rol" options={data.roles} />
        <SelectField name="department_id" label="Departamento" options={data.departments} />

        {result && result.ok === false && (
          <p role="alert" className="text-sm text-[var(--color-error-500,#C2410C)]">
            {result.error}
          </p>
        )}

        <div className="flex gap-3 justify-end">
          <a
            href="/dashboard"
            className="px-4 py-2 text-sm rounded-md border border-[var(--color-neutral-300,#d1d5db)] hover:bg-[var(--color-surface-secondary,#f5f5f0)]"
          >
            Cancelar
          </a>
          <button
            type="submit"
            className="px-4 py-2 text-sm rounded-md bg-[var(--color-primary-500,#3D4A2A)] text-white hover:opacity-90"
          >
            Guardar cambios
          </button>
        </div>
      </Form>

      {/* Form de desactivación — separado para no mezclar mutaciones */}
      <Form method="post" className="bg-white border border-[var(--color-error-200,#fecaca)] rounded-lg p-6">
        <input type="hidden" name="_csrf" value={data.csrfToken} />
        <input type="hidden" name="_mode" value="deactivate" />
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-[var(--color-error-700,#9f1239)]">Desactivar usuario</p>
            <p className="text-sm text-[var(--color-ink-muted)]">
              El usuario perderá acceso pero sus solicitudes y comprobantes se conservan.
            </p>
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-sm rounded-md bg-[var(--color-error-500,#dc2626)] text-white hover:opacity-90"
          >
            Desactivar
          </button>
        </div>
      </Form>
    </section>
  );
}

function Field({
  name,
  label,
  type = "text",
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        className="w-full border-b border-[rgba(10,10,10,0.2)] bg-transparent py-2 outline-none focus:border-[var(--color-primary-500)]"
      />
    </div>
  );
}

function SelectField({
  name,
  label,
  options,
}: {
  name: string;
  label: string;
  options: { id: number; name: string }[];
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">
        {label}
      </label>
      <select
        id={name}
        name={name}
        className="w-full border-b border-[rgba(10,10,10,0.2)] bg-transparent py-2 outline-none focus:border-[var(--color-primary-500)]"
        defaultValue=""
      >
        <option value="">— sin cambio —</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
    </div>
  );
}
