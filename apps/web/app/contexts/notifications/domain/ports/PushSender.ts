/**
 * @module PushSender
 * @description Puerto del slice notifications para Web Push. Los adapters
 * concretos viven en `infrastructure/` (envuelven la lib `web-push` + VAPID).
 */
export interface PushSender {
  /** Clave pública VAPID que el navegador necesita para suscribirse. */
  getVapidPublicKey(): string;
  /** Envía un push a todas las suscripciones registradas del usuario. */
  sendWebPush(userId: number, message: string): Promise<void>;
}
