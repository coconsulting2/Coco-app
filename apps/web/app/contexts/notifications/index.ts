/**
 * @module notifications (slice public API)
 * @description Convertido a TS en sesión D — cero `@ts-ignore` aquí.
 */

export type { Notification } from "~/contexts/notifications/domain/entities/Notification.js";
export type { NotificationRepository } from "~/contexts/notifications/domain/ports/NotificationRepository.js";
export type { PushSender } from "~/contexts/notifications/domain/ports/PushSender.js";
export type { EmailSender } from "~/contexts/notifications/domain/ports/EmailSender.js";
export {
  NotificationsError,
  NotificationNotFoundError,
  PushSubscriptionInvalidError,
} from "~/contexts/notifications/domain/errors.js";

export {
  createNotification,
  listForUser,
  getNotifications,
  markAsRead,
  getUnreadCount,
  getPreferences,
  upsertPreferences,
  subscribePush,
  savePushSubscription,
} from "~/contexts/notifications/application/notificationService.js";
