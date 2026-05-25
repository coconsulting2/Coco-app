/**
 * @module Notification
 * @description Entidad de dominio del slice notifications. Tipos puros —
 * los mappers en `infrastructure/` traducen entre Prisma y este shape.
 */

export type Notification = {
  notificationId: number;
  userId: number;
  kind: string;
  payload: object;
  readAt: Date | null;
};

/**
 * Shape in-app que consumen los componentes (campanita) — paridad 1:1 con el
 * JSON que devolvía el controller legacy `notificationController.getNotifications`.
 */
export type NotificationItem = {
  notificationId: number;
  message: string;
  isRead: boolean;
  createdAt: string;
};

/** Preferencias de notificación de un usuario. */
export type NotificationPreferences = {
  userId: number;
  emailNotif: boolean;
  appNotif: boolean;
  browserNotif: boolean;
};

/** Patch parcial de preferencias (solo flags presentes se actualizan). */
export type NotificationPreferencesPatch = {
  emailNotif?: boolean;
  appNotif?: boolean;
  browserNotif?: boolean;
};

/** Suscripción Web Push tal como la envía el navegador (`subscription.toJSON()`). */
export type WebPushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};
