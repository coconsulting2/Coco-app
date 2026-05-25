/**
 * @module notificationsApi.server
 * @description Dispatcher /api/notifications/* — resource route RR7 que sirve a
 * `NotificationBell` / `NotificationPreferences` vía loader/useFetcher (en vez
 * de fetch directo al backend Express legacy). Paridad 1:1 con el controller
 * legacy `notificationController.js`:
 *   GET    /notifications/:userId                 → listNotifications
 *   GET    /notifications/:userId/unread-count    → getUnreadCount
 *   PUT    /notifications/:id/read                → markNotificationRead
 *   GET    /notifications/preferences/:userId     → getNotificationPreferences
 *   PUT    /notifications/preferences/:userId     → setNotificationPreferences
 *   GET    /notifications/vapid-public-key        → getVapidPublicKey
 *   POST   /notifications/subscribe               → subscribePush
 *
 * Decisión Web Push (regla 4): las APIs del navegador (vapid-public-key /
 * subscribe) NO son fetch a un backend externo: se sirven aquí como resource
 * route RR7 (action). El componente las consume con `useFetcher`. La
 * registración del service worker sigue siendo client-side (no es fetch a /api).
 *
 * Seguridad: todos los endpoints user-scoped se fuerzan al `session.user.user_id`
 * (RLS + tenant) — el `:userId` del path se ignora para datos ajenos.
 */
import { jsonOk, jsonError, jsonFromError } from "~/platform/http/responses";
import { requireSession, runInTenant } from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";
import {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  getNotificationPreferences,
  setNotificationPreferences,
  subscribePush,
  getVapidPublicKey,
} from "~/contexts/notifications/index.js";
import type {
  NotificationPreferencesPatch,
  WebPushSubscription,
} from "~/contexts/notifications/index.js";

type DispatchArgs = { request: Request; subpath: string };

type HandlerCtx = {
  userId: number;
  body: Record<string, unknown> | null;
};

const ROUTES: Array<{
  method: string;
  pattern: RegExp;
  handler: (m: RegExpMatchArray, ctx: HandlerCtx) => Promise<unknown> | unknown;
}> = [
  // GET /notifications/vapid-public-key — debe ir antes que /:userId.
  {
    method: "GET",
    pattern: /^vapid-public-key$/,
    handler: () => ({ key: getVapidPublicKey() }),
  },
  // GET /notifications/preferences/:userId
  {
    method: "GET",
    pattern: /^preferences\/(\d+)$/,
    handler: (_m, { userId }) => getNotificationPreferences(userId),
  },
  // PUT /notifications/preferences/:userId
  {
    method: "PUT",
    pattern: /^preferences\/(\d+)$/,
    handler: (_m, { userId, body }) =>
      setNotificationPreferences(userId, normalizePrefs(body)),
  },
  // GET /notifications/:userId/unread-count
  {
    method: "GET",
    pattern: /^(\d+)\/unread-count$/,
    handler: async (_m, { userId }) => ({ count: await getUnreadCount(userId) }),
  },
  // PUT /notifications/:id/read
  {
    method: "PUT",
    pattern: /^(\d+)\/read$/,
    handler: (m, _ctx) => markNotificationRead(Number(m[1])),
  },
  // POST /notifications/subscribe
  {
    method: "POST",
    pattern: /^subscribe$/,
    handler: (_m, { userId, body }) => {
      const subscription = extractSubscription(body);
      if (!subscription) {
        throw makeBadRequest("Invalid subscription payload");
      }
      return subscribePush(userId, subscription);
    },
  },
  // GET /notifications/ (lista del usuario en sesión) + /notifications/:userId
  {
    method: "GET",
    pattern: /^(\d*)$/,
    handler: (_m, { userId }) => listNotifications(userId),
  },
];

export async function dispatchNotificationsApi({ request, subpath }: DispatchArgs): Promise<Response> {
  const method = request.method.toUpperCase();
  const path = (subpath.split("?")[0] ?? "").replace(/^\/+|\/+$/g, "");

  try {
    const session = await requireSession(request);
    const userId = Number(session.user.user_id);

    for (const r of ROUTES) {
      if (r.method !== method) continue;
      const m = path.match(r.pattern);
      if (!m) continue;
      if (method !== "GET" && method !== "HEAD") {
        await assertCsrf(request);
      }
      const body =
        method !== "GET" && method !== "HEAD" ? await readJson(request) : null;
      const result = await runInTenant(session, async () =>
        r.handler(m, { userId, body }),
      );
      return jsonOk(result ?? { ok: true });
    }
    return jsonError(404, `Unknown notifications endpoint: ${method} ${path}`, "UNKNOWN_ENDPOINT");
  } catch (err) {
    return jsonFromError(err);
  }
}

function normalizePrefs(body: Record<string, unknown> | null): NotificationPreferencesPatch {
  const data: NotificationPreferencesPatch = {};
  if (body && typeof body.emailNotif === "boolean") data.emailNotif = body.emailNotif;
  if (body && typeof body.appNotif === "boolean") data.appNotif = body.appNotif;
  if (body && typeof body.browserNotif === "boolean") data.browserNotif = body.browserNotif;
  return data;
}

function extractSubscription(
  body: Record<string, unknown> | null,
): WebPushSubscription | null {
  const sub = body?.subscription as Partial<WebPushSubscription> | undefined;
  if (!sub || typeof sub.endpoint !== "string" || !sub.keys) return null;
  const keys = sub.keys as Partial<WebPushSubscription["keys"]>;
  if (typeof keys.p256dh !== "string" || typeof keys.auth !== "string") return null;
  return { endpoint: sub.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

function makeBadRequest(message: string): Error & { statusCode: number; error: string } {
  const err = new Error(message) as Error & { statusCode: number; error: string };
  err.statusCode = 400;
  err.error = "BAD_REQUEST";
  return err;
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const text = await request.text();
    if (!text) return null;
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
