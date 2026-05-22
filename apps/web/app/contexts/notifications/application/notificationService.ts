/**
 * @module notificationService
 * @description Use-cases del slice notifications.
 */
import NotificationModel from "~/contexts/notifications/infrastructure/notificationModel.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — platform/push legacy .js (pendiente refactor)
import { sendPushToUser } from "~/platform/push/webpush.server.js";

export async function createNotification(
  userId: number,
  message: string,
): Promise<unknown> {
  const pref = await NotificationModel.findPreferences(userId);
  const appEnabled = pref ? pref.appNotif : true;
  const browserEnabled = pref ? pref.browserNotif : true;

  let notification: unknown = null;
  if (appEnabled) {
    notification = await NotificationModel.createForUser(userId, message);
  }
  if (browserEnabled) {
    try {
      await sendPushToUser(userId, message);
    } catch (err) {
      console.error("Web push failed for user", userId, err);
    }
  }
  return notification;
}

export async function listForUser(userId: number): Promise<unknown[]> {
  return NotificationModel.listRecent(userId);
}

export const getNotifications = listForUser;

export async function markAsRead(notificationId: number): Promise<unknown> {
  return NotificationModel.markRead(notificationId);
}

export async function getUnreadCount(userId: number): Promise<number> {
  return NotificationModel.countUnread(userId);
}

export async function getPreferences(userId: number): Promise<{
  userId: number;
  emailNotif: boolean;
  appNotif: boolean;
  browserNotif: boolean;
}> {
  const pref = await NotificationModel.findPreferences(userId);
  return pref ?? { userId, emailNotif: true, appNotif: true, browserNotif: true };
}

export async function upsertPreferences(
  userId: number,
  data: { emailNotif?: boolean; appNotif?: boolean; browserNotif?: boolean },
): Promise<unknown> {
  return NotificationModel.upsertPreferences(userId, data);
}

export async function subscribePush(
  userId: number,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
): Promise<unknown> {
  return NotificationModel.upsertPushSubscription(userId, subscription);
}

export const savePushSubscription = subscribePush;
