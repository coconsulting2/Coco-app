/**
 * @module perfil-usuario
 * @description Perfil del usuario autenticado. Loader llama directamente a
 * `userService.getUserById(userId)`. Action soporta logout (vía PageHeader form).
 *
 * En el legacy esta página vivía en pages/perfil-usuario.astro y hacía
 * fetch a /api/user/get-user-data/:id. Ahora se resuelve server-side sin
 * round-trip.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData } from "react-router";

import { requireSession, runInTenant } from "~/platform/session/requireUser.server";
import { buildLogoutCookies } from "~/platform/session/session.server";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — JS module
import * as userService from "~/contexts/identity/application/userService.js";

export function meta() {
  return [{ title: "Perfil — CocoConsulting" }];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requireSession(request);
  const profile = await runInTenant(session, async () =>
    userService.getUserById(session.user.user_id),
  );
  return { profile };
}

export async function action({ request }: ActionFunctionArgs) {
  // Logout path: PageHeader posta a `/perfil-usuario?logout=1`.
  const url = new URL(request.url);
  if (url.searchParams.get("logout") === "1") {
    const headers = new Headers();
    for (const c of buildLogoutCookies()) headers.append("set-cookie", c);
    headers.set("location", "/login");
    return new Response(null, { status: 302, headers });
  }
  return redirect("/perfil-usuario");
}

export default function PerfilRoute() {
  const data = useLoaderData() as Awaited<ReturnType<typeof loader>>;
  const profile = data.profile;
  if (!profile) {
    return (
      <section className="max-w-3xl mx-auto py-12 text-center">
        <p className="text-[var(--color-ink-muted)]">No se encontró información del usuario.</p>
      </section>
    );
  }

  return (
    <section className="max-w-3xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">
          Perfil
        </p>
        <h1 className="font-serif text-3xl md:text-4xl text-[var(--color-ink)]">
          {profile.user_name}
        </h1>
        <p className="text-[var(--color-ink-muted)]">{profile.role_name}</p>
      </header>

      <dl className="grid gap-4 md:grid-cols-2">
        <Field label="Email" value={profile.email ?? "—"} />
        <Field label="Teléfono" value={profile.phone_number ?? "—"} />
        <Field label="Puesto" value={profile.workstation ?? "—"} />
        <Field label="No. empleado" value={profile.no_empleado ?? "—"} />
        <Field label="Departamento" value={profile.department_name ?? "—"} />
        <Field label="Centro de costos" value={profile.costs_center ?? "—"} />
        <Field
          label="Fecha de alta"
          value={profile.creation_date ? formatDate(profile.creation_date) : "—"}
        />
      </dl>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-editorial bg-white border border-[var(--color-neutral-200,#e5e7eb)] rounded-lg p-4">
      <dt className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)] mb-1">
        {label}
      </dt>
      <dd className="text-sm font-medium text-[var(--color-ink)]">{value}</dd>
    </div>
  );
}

function formatDate(date: Date | string): string {
  try {
    return new Date(date).toISOString().split("T")[0]!;
  } catch {
    return String(date);
  }
}
