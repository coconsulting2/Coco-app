/**
 * @module notificaciones
 * @description Bandeja de notificaciones del usuario. Loader carga la lista vía
 * el use-case `listNotifications` (DI, sin fetch HTTP). Action maneja el intent
 * `mark-read` (`markNotificationRead`) con CSRF + RLS. La campanita global
 * (`NotificationBell`, montada en el layout) postea su mark-read al action de
 * ESTA ruta; la revalidación re-corre el loader del layout y refresca la lista.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useLoaderData } from "react-router";

import { requireSession, runInTenant, runInRls } from "~/platform/session/requireUser.server";
import { assertCsrf, issueCsrfToken } from "~/platform/csrf/csrf.server";
import { listNotifications, markNotificationRead } from "~/contexts/notifications";
import type { NotificationItem } from "~/contexts/notifications";

export function meta() {
  return [{ title: "Notificaciones — CocoConsulting" }];
}

type LoaderData = { notifications: NotificationItem[]; csrfToken: string };

export async function loader({ request }: LoaderFunctionArgs): Promise<Response> {
  const session = await requireSession(request);
  const notifications = await runInTenant(session, async () =>
    listNotifications(session.user.user_id),
  );
  const csrf = issueCsrfToken(request);
  const payload: LoaderData = { notifications, csrfToken: csrf.token };
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json", "set-cookie": csrf.setCookie },
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const session = await requireSession(request);
  await assertCsrf(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");

  if (intent === "mark-read") {
    const notificationId = Number(form.get("notificationId"));
    if (!Number.isFinite(notificationId) || notificationId < 1) {
      return { ok: false, error: "notificationId inválido" };
    }
    await runInRls(session, async () => markNotificationRead(notificationId));
    return { ok: true };
  }

  return { ok: false, error: `Intent no soportado: ${intent}` };
}

export default function NotificacionesPage() {
  const { notifications, csrfToken } = useLoaderData() as LoaderData;

  return (
    <section className="max-w-3xl mx-auto space-y-6">
      <header className="space-y-1">
        <h1 className="font-serif text-3xl md:text-4xl">Notificaciones</h1>
        <p className="text-[var(--color-ink-secondary)]">
          {notifications.length === 0 ? "No tienes notificaciones." : `${notifications.length} en total.`}
        </p>
      </header>

      <ul className="divide-y divide-[var(--color-neutral-200)] rounded-[var(--radius-lg)] border border-[var(--color-neutral-200)] bg-[var(--color-surface-white)]">
        {notifications.map((n) => (
          <li
            key={n.notificationId}
            className="flex items-start justify-between gap-4 p-4"
          >
            <div className="min-w-0">
              <p className={n.isRead ? "text-[var(--color-ink-muted)]" : "font-medium text-[var(--color-ink)]"}>
                {n.message}
              </p>
              <time className="text-xs text-[var(--color-ink-muted)]">
                {new Date(n.createdAt).toLocaleString("es-MX")}
              </time>
            </div>
            {!n.isRead && (
              <Form method="post">
                <input type="hidden" name="_csrf" value={csrfToken} />
                <input type="hidden" name="intent" value="mark-read" />
                <input type="hidden" name="notificationId" value={n.notificationId} />
                <button
                  type="submit"
                  className="shrink-0 rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] px-3 py-1 text-sm hover:bg-[var(--color-surface-secondary)]"
                >
                  Marcar leída
                </button>
              </Form>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
