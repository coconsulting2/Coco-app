/**
 * @module index
 * @description API pública del slice notifications.
 */

export type { Notification } from "~/contexts/notifications/domain/entities/Notification";
export type { NotificationRepository } from "~/contexts/notifications/domain/ports/NotificationRepository";
export type { PushSender } from "~/contexts/notifications/domain/ports/PushSender";
export type { EmailSender } from "~/contexts/notifications/domain/ports/EmailSender";
export { NotificationsError, NotificationNotFoundError, PushSubscriptionInvalidError } from "~/contexts/notifications/domain/errors";

// @ts-ignore — JS module
export { createNotification, listForUser, markAsRead, subscribePush } from "~/contexts/notifications/application/notificationService.js";
