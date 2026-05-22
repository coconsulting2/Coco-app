/**
 * @module errors
 * @description Errores tipados del dominio del slice notifications.
 */
export class NotificationsError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number = 400) {
    super(message);
    this.name = "NotificationsError";
  }
}

export class NotificationNotFoundError extends NotificationsError {
  constructor(message?: string) { super(message ?? "NotificationNotFoundError", "NOTIFICATIONNOTFOUND"); }
}

export class PushSubscriptionInvalidError extends NotificationsError {
  constructor(message?: string) { super(message ?? "PushSubscriptionInvalidError", "PUSHSUBSCRIPTIONINVALID"); }
}
