/**
 * @module NotificationRepository
 * @description Puerto del slice notifications. Los adapters concretos viven en
 * `infrastructure/`. Tipa el acceso a notificaciones, preferencias y
 * suscripciones push sin acoplar el dominio a Prisma.
 */
import type {
  NotificationItem,
  NotificationPreferences,
  NotificationPreferencesPatch,
  WebPushSubscription,
} from "~/contexts/notifications/domain/entities/Notification.js";

export interface NotificationRepository {
  createForUser(userId: number, message: string): Promise<NotificationItem>;
  listRecent(userId: number): Promise<NotificationItem[]>;
  markRead(notificationId: number): Promise<NotificationItem>;
  countUnread(userId: number): Promise<number>;
  findPreferences(userId: number): Promise<NotificationPreferences | null>;
  upsertPreferences(
    userId: number,
    data: NotificationPreferencesPatch,
  ): Promise<NotificationPreferences>;
  upsertPushSubscription(
    userId: number,
    subscription: WebPushSubscription,
  ): Promise<unknown>;
}
