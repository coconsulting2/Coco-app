/**
 * @module notificationService
 * @description Use-cases del slice notifications (hexagonal). Cada use-case
 * recibe sus dependencias por parámetro (DI) — `NotificationRepository` para
 * persistencia y `PushSender` para Web Push. NO conoce Prisma ni `web-push`
 * directamente; eso vive en los adapters de `infrastructure/`.
 *
 * Paridad 1:1 con el controller legacy `notificationController.js`:
 *   - listNotifications          ← GET  /notifications/:userId
 *   - getUnreadCount             ← GET  /notifications/:userId/unread-count
 *   - markNotificationRead       ← PUT  /notifications/:id/read
 *   - getNotificationPreferences ← GET  /notifications/preferences/:userId
 *   - setNotificationPreferences ← PUT  /notifications/preferences/:userId
 *   - subscribePush              ← POST /notifications/subscribe
 *   - getVapidPublicKey          ← GET  /notifications/vapid-public-key
 *   - createNotification         ← side-effect interno (in-app + push según prefs)
 */
import type { NotificationRepository } from "~/contexts/notifications/domain/ports/NotificationRepository.js";
import type { PushSender } from "~/contexts/notifications/domain/ports/PushSender.js";
import type {
  NotificationItem,
  NotificationPreferences,
  NotificationPreferencesPatch,
  WebPushSubscription,
} from "~/contexts/notifications/domain/entities/Notification.js";

export type NotificationRepoDeps = { repo: NotificationRepository };
export type NotificationPushDeps = { repo: NotificationRepository; push: PushSender };

/**
 * Crea una notificación in-app (si el usuario lo permite) y dispara web push
 * (si lo permite). Réplica de `notificationService.createNotification` legacy.
 */
export async function createNotification(
  userId: number,
  message: string,
  deps: NotificationPushDeps,
): Promise<NotificationItem | null> {
  const pref = await deps.repo.findPreferences(userId);
  const appEnabled = pref ? pref.appNotif : true;
  const browserEnabled = pref ? pref.browserNotif : true;

  let notification: NotificationItem | null = null;
  if (appEnabled) {
    notification = await deps.repo.createForUser(userId, message);
  }
  if (browserEnabled) {
    try {
      await deps.push.sendWebPush(userId, message);
    } catch (err) {
      console.error("Web push failed for user", userId, err);
    }
  }
  return notification;
}

export async function listNotifications(
  userId: number,
  deps: NotificationRepoDeps,
): Promise<NotificationItem[]> {
  return deps.repo.listRecent(userId);
}

export async function markNotificationRead(
  notificationId: number,
  deps: NotificationRepoDeps,
): Promise<NotificationItem> {
  return deps.repo.markRead(notificationId);
}

export async function getUnreadCount(
  userId: number,
  deps: NotificationRepoDeps,
): Promise<number> {
  return deps.repo.countUnread(userId);
}

export async function getNotificationPreferences(
  userId: number,
  deps: NotificationRepoDeps,
): Promise<NotificationPreferences> {
  const pref = await deps.repo.findPreferences(userId);
  return pref ?? { userId, emailNotif: true, appNotif: true, browserNotif: true };
}

export async function setNotificationPreferences(
  userId: number,
  data: NotificationPreferencesPatch,
  deps: NotificationRepoDeps,
): Promise<NotificationPreferences> {
  return deps.repo.upsertPreferences(userId, data);
}

export async function subscribePush(
  userId: number,
  subscription: WebPushSubscription,
  deps: NotificationRepoDeps,
): Promise<unknown> {
  return deps.repo.upsertPushSubscription(userId, subscription);
}

export function getVapidPublicKey(deps: { push: PushSender }): string {
  return deps.push.getVapidPublicKey();
}
