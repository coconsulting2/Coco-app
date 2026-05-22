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
