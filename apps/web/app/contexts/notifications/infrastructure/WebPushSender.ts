/**
 * @module WebPushSender
 * @description Adapter concreto del puerto `PushSender` sobre la librería
 * `web-push` + VAPID. Réplica 1:1 del legacy `platform/push/webpush.server.js`
 * (`sendPushToUser` + `getVapidPublicKey`), pero tipado y dentro del slice
 * (capa infrastructure — único lugar autorizado a tocar Prisma).
 *
 * VAPID keys vienen de env (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
 * `VAPID_MAILTO`). Si no están configuradas, el envío push es no-op (igual que
 * el legacy) para no romper el flujo in-app/email.
 */
import webpush from "web-push";
import prisma from "~/platform/db/prisma.server.js";
import type { PushSender } from "~/contexts/notifications/domain/ports/PushSender.js";

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_MAILTO = process.env.VAPID_MAILTO || "mailto:admin@coconsulting.com";

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  if (VAPID_PUBLIC && VAPID_PRIVATE) {
    webpush.setVapidDetails(VAPID_MAILTO, VAPID_PUBLIC, VAPID_PRIVATE);
    configured = true;
  }
  return configured;
}

type PushSubscriptionRow = {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export class WebPushSender implements PushSender {
  getVapidPublicKey(): string {
    return VAPID_PUBLIC;
  }

  async sendWebPush(userId: number, message: string): Promise<void> {
    if (!ensureConfigured()) {
      console.warn("VAPID keys not configured — skipping web push");
      return;
    }

    const subscriptions = (await prisma.pushSubscription.findMany({
      where: { userId },
    })) as PushSubscriptionRow[];

    const payload = JSON.stringify({
      title: "CocoAPI — Nueva notificación",
      body: message,
      icon: "/Logo.svg",
    });

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        ),
      ),
    );

    // Limpia suscripciones expiradas/ inválidas (410 Gone / 404).
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result && result.status === "rejected") {
        const err = result.reason as { statusCode?: number } | undefined;
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          const sub = subscriptions[i];
          if (sub) {
            await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          }
        }
      }
    }
  }
}
