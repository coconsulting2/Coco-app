/**
 * @module perfil-usuario
 * @description Perfil del usuario autenticado. Loader llama los use-cases
 * `getUserProfile` (identity) + `getNotificationPreferences`/`getVapidPublicKey`
 * (notifications) del slice directamente — sin round-trip a /api. La `action`
 * expone los intents `save-preferences` y `subscribe-push` (`assertCsrf` +
 * runInTenant → use-cases) que `NotificationPreferences` postea vía useFetcher.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData } from "react-router";

import { requireSession, runInTenant } from "~/platform/session/requireUser.server";
import { buildLogoutCookies } from "~/platform/session/session.server";
import { assertCsrf, issueCsrfToken } from "~/platform/csrf/csrf.server";
import { getUserProfile, UserNotFoundError } from "~/contexts/identity";
import {
  getNotificationPreferences,
  getVapidPublicKey,
  setNotificationPreferences,
  subscribePush,
} from "~/contexts/notifications";
import type {
  NotificationPreferencesPatch,
  WebPushSubscription,
} from "~/contexts/notifications";
import NotificationPreferences from "~/shared/ui/NotificationPreferences";

export function meta() {
  return [{ title: "Perfil — CocoConsulting" }];
}

type ProfileShape = {
  user_name: string;
  email: string | null;
  phone_number: string | null;
  workstation: string | null;
  no_empleado: string | null;
  department_name: string | null;
  costs_center: string | null;
  creation_date: Date | string | null;
  role_name: string;
};

type LoaderData = {
  profile: ProfileShape | null;
  prefs: { emailNotif: boolean; appNotif: boolean; browserNotif: boolean };
  vapidPublicKey: string;
  csrfToken: string;
};

export async function loader({ request }: LoaderFunctionArgs): Promise<Response> {
  const session = await requireSession(request);
  const csrf = issueCsrfToken(request);

  let profile: ProfileShape | null = null;
  let prefs = { emailNotif: true, appNotif: true, browserNotif: true };

  try {
    const result = await runInTenant(session, async () => {
      const p = await getUserProfile(session.user.user_id);
      const pr = await getNotificationPreferences(session.user.user_id);
      return { p, pr };
    });
    // Wire shape para el componente (snake_case por compatibilidad con el legacy).
    profile = {
      user_name: result.p.username,
      email: result.p.email,
      phone_number: result.p.phoneNumber,
      workstation: result.p.workstation,
      no_empleado: result.p.employeeNumber,
      department_name: result.p.departmentName,
      costs_center: result.p.costsCenter,
      creation_date: result.p.creationDate,
      role_name: result.p.roleName,
    };
    prefs = {
      emailNotif: result.pr.emailNotif,
      appNotif: result.pr.appNotif,
      browserNotif: result.pr.browserNotif,
    };
  } catch (err) {
    if (!(err instanceof UserNotFoundError)) throw err;
    profile = null;
  }

  const vapidPublicKey = getVapidPublicKey();
  const payload: LoaderData = { profile, prefs, vapidPublicKey, csrfToken: csrf.token };
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json", "set-cookie": csrf.setCookie },
  });
}

function parseBoolField(value: FormDataEntryValue | null): boolean | undefined {
  if (value === null) return undefined;
  const s = String(value);
  if (s === "true") return true;
  if (s === "false") return false;
  return undefined;
}

export async function action({ request }: ActionFunctionArgs) {
  const url = new URL(request.url);
  if (url.searchParams.get("logout") === "1") {
    const headers = new Headers();
    for (const c of buildLogoutCookies()) headers.append("set-cookie", c);
    headers.set("location", "/login");
    return new Response(null, { status: 302, headers });
  }

  const session = await requireSession(request);
  await assertCsrf(request);
  const form = await request.formData();
  const intent = String(form.get("_intent") ?? "");

  if (intent === "save-preferences") {
    const patch: NotificationPreferencesPatch = {};
    const email = parseBoolField(form.get("emailNotif"));
    const app = parseBoolField(form.get("appNotif"));
    const browser = parseBoolField(form.get("browserNotif"));
    if (email !== undefined) patch.emailNotif = email;
    if (app !== undefined) patch.appNotif = app;
    if (browser !== undefined) patch.browserNotif = browser;
    const updated = await runInTenant(session, async () =>
      setNotificationPreferences(session.user.user_id, patch),
    );
    return { ok: true, intent, prefs: updated };
  }

  if (intent === "subscribe-push") {
    const raw = form.get("subscription");
    if (raw === null) {
      return { ok: false, error: "subscription requerida" };
    }
    let subscription: WebPushSubscription;
    try {
      subscription = JSON.parse(String(raw)) as WebPushSubscription;
    } catch {
      return { ok: false, error: "subscription inválida" };
    }
    if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return { ok: false, error: "subscription inválida" };
    }
    await runInTenant(session, async () =>
      subscribePush(session.user.user_id, subscription),
    );
    return { ok: true, intent };
  }

  return redirect("/perfil-usuario");
}

export default function PerfilRoute() {
  const data = useLoaderData() as LoaderData;
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

      <section className="card-editorial bg-white border border-[var(--color-neutral-200,#e5e7eb)] rounded-lg p-6">
        <h2 className="font-editorial text-lg font-normal text-[var(--color-ink)] mb-5">
          Preferencias de notificación
        </h2>
        <NotificationPreferences
          prefs={data.prefs}
          vapidPublicKey={data.vapidPublicKey}
          csrfToken={data.csrfToken}
        />
      </section>
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
