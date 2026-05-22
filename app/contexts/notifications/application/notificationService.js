/**
 * @module notificationService
 * @description Use-cases del slice notifications. Wrapper de orquestación
 * sobre `notificationModel` — NO toca Prisma directamente. Cumple
 * arquitectura hexagonal (Fase 6 hardening completado para este slice).
 */
import NotificationModel from "~/contexts/notifications/infrastructure/notificationModel.js";
import { sendPushToUser } from "~/platform/push/webpush.server.js";

/**
 * Crea una notificación in-app respetando las preferencias del usuario.
 * Si la preferencia de push está activa, también envía web-push.
 *
 * @param {number} userId
 * @param {string} message
 * @returns {Promise<object|null>}
 */
export async function createNotification(userId, message) {
  const pref = await NotificationModel.findPreferences(userId);
  const appEnabled = pref ? pref.appNotif : true;
  const browserEnabled = pref ? pref.browserNotif : true;

  let notification = null;
  if (appEnabled) {
    notification = await NotificationModel.createForUser(userId, message);
  }
  if (browserEnabled) {
    try {
      await sendPushToUser(userId, message);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Web push failed for user", userId, err);
    }
  }
  return notification;
}

/**
 * Lista las notificaciones recientes del usuario.
 * @param {number} userId
 * @returns {Promise<object[]>}
 */
export async function listForUser(userId) {
  return NotificationModel.listRecent(userId);
}

/** Alias legacy. */
export const getNotifications = listForUser;

/**
 * Marca una notificación como leída.
 * @param {number} notificationId
 * @returns {Promise<object>}
 */
export async function markAsRead(notificationId) {
  return NotificationModel.markRead(notificationId);
}

/**
 * @param {number} userId
 * @returns {Promise<number>}
 */
export async function getUnreadCount(userId) {
  return NotificationModel.countUnread(userId);
}

/**
 * @param {number} userId
 * @returns {Promise<object>}
 */
export async function getPreferences(userId) {
  const pref = await NotificationModel.findPreferences(userId);
  return pref || { userId, emailNotif: true, appNotif: true, browserNotif: true };
}

/**
 * @param {number} userId
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function upsertPreferences(userId, data) {
  return NotificationModel.upsertPreferences(userId, data);
}

/**
 * Suscripción de Web Push.
 * @param {number} userId
 * @param {object} subscription
 * @returns {Promise<object>}
 */
export async function subscribePush(userId, subscription) {
  return NotificationModel.upsertPushSubscription(userId, subscription);
}

/** Alias legacy del backend. */
export const savePushSubscription = subscribePush;
