/**
 * @module crear-usuario
 * @description Crear nuevo usuario (admin). Loader devuelve roles + departments
 * del tenant activo (RLS-scoped). Action invoca el use-case `createUser` del
 * slice identity directamente — sin fetch HTTP.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, redirect, useActionData, useLoaderData } from "react-router";

import { requirePermissions, runInTenant } from "~/platform/session/requireUser.server";
import { assertCsrf, issueCsrfToken } from "~/platform/csrf/csrf.server";
import {
  createUser,
  listAvailableRoles,
  listAvailableDepartments,
  EmailAlreadyUsedError,
  type CreateUserInput,
} from "~/contexts/identity";

export function meta() {
  return [{ title: "Crear usuario — CocoConsulting" }];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requirePermissions(request, "user:create");
  const [roles, departments, csrf] = await Promise.all([
    runInTenant(session, listAvailableRoles),
    runInTenant(session, listAvailableDepartments),
    Promise.resolve(issueCsrfToken(request)),
  ]);
  const headers = new Headers();
  headers.append("set-cookie", csrf.setCookie);
  return new Response(
    JSON.stringify({
      roles,
      departments,
      csrfToken: csrf.token,
      orgId: session.organizationId.toString(),
    }),
    {
      status: 200,
      headers: { "content-type": "application/json", ...Object.fromEntries(headers) },
    },
  );
}

type ActionResult = { ok: true } | { ok: false; error: string };

export async function action({ request }: ActionFunctionArgs): Promise<Response> {
  const session = await requirePermissions(request, "user:create");
  await assertCsrf(request);

  const form = await request.formData();
  const input: CreateUserInput = {
    organizationId:
      form.get("organization_id")?.toString() ?? session.organizationId.toString(),
    roleId: Number(form.get("role_id")),
    departmentId: Number(form.get("department_id")),
    username: form.get("user_name")?.toString() ?? "",
    password: form.get("password")?.toString() ?? "",
    workstation: form.get("workstation")?.toString() ?? "",
    email: form.get("email")?.toString() ?? "",
    phoneNumber: form.get("phone_number")?.toString() ?? "",
  };

  if (!input.username || !input.password || !input.email) {
    return Response.json(
      { ok: false, error: "user_name, password, email son obligatorios" } satisfies ActionResult,
      { status: 400 },
    );
  }

  try {
    await runInTenant(session, async () => createUser(input));
  } catch (err) {
    if (err instanceof EmailAlreadyUsedError) {
      return Response.json(
        { ok: false, error: err.message } satisfies ActionResult,
        { status: 400 },
      );
    }
    const e = err as { message?: string; status?: number };
    return Response.json(
      { ok: false, error: e?.message ?? "Error creando usuario" } satisfies ActionResult,
      { status: e?.status ?? 500 },
    );
  }

  return redirect("/dashboard");
}

type LoaderData = {
  roles: { id: number; name: string }[];
  departments: { id: number; name: string }[];
  csrfToken: string;
  orgId: string;
};

export default function CrearUsuarioRoute() {
  const data = useLoaderData() as LoaderData;
  const result = useActionData() as ActionResult | undefined;

  return (
    <section className="max-w-3xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">
          Coco / Administración / Nuevo
        </p>
        <h1 className="font-serif text-3xl md:text-4xl text-[var(--color-ink)]">
          Crear nuevo usuario
        </h1>
        <p className="text-[var(--color-ink-muted)]">
          Complete el formulario con los datos del nuevo usuario.
        </p>
      </header>

      <Form
        method="post"
        className="space-y-5 bg-white border border-[var(--color-neutral-200,#e5e7eb)] rounded-lg p-6"
      >
        <input type="hidden" name="_csrf" value={data.csrfToken} />
        <input type="hidden" name="organization_id" value={data.orgId} />

        <Field name="user_name" label="Usuario" required />
        <Field name="password" label="Contraseña" type="password" required minLength={6} />
        <Field name="email" label="Email" type="email" required />
        <Field name="phone_number" label="Teléfono" type="tel" />
        <Field name="workstation" label="Puesto" />

        <SelectField name="role_id" label="Rol" options={data.roles} required />
        <SelectField name="department_id" label="Departamento" options={data.departments} required />

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
            Crear usuario
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
  required = false,
  minLength,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={name}
        className="block text-xs uppercase tracking-widest text-[var(--color-ink-muted)]"
      >
        {label}
        {required && " *"}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        minLength={minLength}
        className="w-full border-b border-[rgba(10,10,10,0.2)] bg-transparent py-2 outline-none focus:border-[var(--color-primary-500)]"
      />
    </div>
  );
}

function SelectField({
  name,
  label,
  options,
  required = false,
}: {
  name: string;
  label: string;
  options: { id: number; name: string }[];
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={name}
        className="block text-xs uppercase tracking-widest text-[var(--color-ink-muted)]"
      >
        {label}
        {required && " *"}
      </label>
      <select
        id={name}
        name={name}
        required={required}
        className="w-full border-b border-[rgba(10,10,10,0.2)] bg-transparent py-2 outline-none focus:border-[var(--color-primary-500)]"
        defaultValue=""
      >
        <option value="" disabled>
          — selecciona —
        </option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}
