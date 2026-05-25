/**
 * @module notifications (slice public API + composition root)
 * @description Fachada estable del slice notifications. Rutas/loaders/actions y
 * otros slices importan SOLO desde aquí.
 *
 * Patrón hexagonal (igual que `contexts/identity`):
 *   - Use-cases en `application/` reciben dependencias por parámetro (DI).
 *   - Adapters concretos en `infrastructure/` implementan los ports del `domain/`.
 *   - Este index expone use-cases pre-wired con los adapters por default (lo que
 *     rutas/dispatcher consumen) y re-exporta los raw use-cases para que los
 *     tests inyecten stubs.
 */

// ── Domain types + errores ────────────────────────────────────────────────
export type {
  Notification,
  NotificationItem,
  NotificationPreferences,
  NotificationPreferencesPatch,
  WebPushSubscription,
} from "~/contexts/notifications/domain/entities/Notification.js";
export type { NotificationRepository } from "~/contexts/notifications/domain/ports/NotificationRepository.js";
export type { PushSender } from "~/contexts/notifications/domain/ports/PushSender.js";
export type { EmailSender } from "~/contexts/notifications/domain/ports/EmailSender.js";
export {
  NotificationsError,
  NotificationNotFoundError,
  PushSubscriptionInvalidError,
} from "~/contexts/notifications/domain/errors.js";

// ── Composition root (default deps) ───────────────────────────────────────
import { PrismaNotificationRepository } from "~/contexts/notifications/infrastructure/PrismaNotificationRepository.js";
import { WebPushSender } from "~/contexts/notifications/infrastructure/WebPushSender.js";
import * as service from "~/contexts/notifications/application/notificationService.js";
import type {
  NotificationPreferencesPatch,
  WebPushSubscription,
} from "~/contexts/notifications/domain/entities/Notification.js";

const defaultRepo = new PrismaNotificationRepository();
const defaultPush = new WebPushSender();

// ── Use-cases pre-wired (lo que rutas/dispatcher consumen) ────────────────

export const createNotification = (userId: number, message: string) =>
  service.createNotification(userId, message, { repo: defaultRepo, push: defaultPush });

export const listNotifications = (userId: number) =>
  service.listNotifications(userId, { repo: defaultRepo });

export const markNotificationRead = (notificationId: number) =>
  service.markNotificationRead(notificationId, { repo: defaultRepo });

export const getUnreadCount = (userId: number) =>
  service.getUnreadCount(userId, { repo: defaultRepo });

export const getNotificationPreferences = (userId: number) =>
  service.getNotificationPreferences(userId, { repo: defaultRepo });

export const setNotificationPreferences = (
  userId: number,
  data: NotificationPreferencesPatch,
) => service.setNotificationPreferences(userId, data, { repo: defaultRepo });

export const subscribePush = (userId: number, subscription: WebPushSubscription) =>
  service.subscribePush(userId, subscription, { repo: defaultRepo });

export const getVapidPublicKey = () => service.getVapidPublicKey({ push: defaultPush });

// ── Aliases backward-compat (nombres previos del slice public API) ────────
export const listForUser = listNotifications;
export const getNotifications = listNotifications;
export const markAsRead = markNotificationRead;
export const getPreferences = getNotificationPreferences;
export const upsertPreferences = setNotificationPreferences;
export const savePushSubscription = subscribePush;

// ── Raw use-cases (para tests + composiciones custom) ─────────────────────
export const usecases = {
  createNotification: service.createNotification,
  listNotifications: service.listNotifications,
  markNotificationRead: service.markNotificationRead,
  getUnreadCount: service.getUnreadCount,
  getNotificationPreferences: service.getNotificationPreferences,
  setNotificationPreferences: service.setNotificationPreferences,
  subscribePush: service.subscribePush,
  getVapidPublicKey: service.getVapidPublicKey,
} as const;

// ── Default adapters export (para tests que quieran reusarlos) ────────────
export const adapters = {
  NotificationRepository: PrismaNotificationRepository,
  PushSender: WebPushSender,
} as const;
