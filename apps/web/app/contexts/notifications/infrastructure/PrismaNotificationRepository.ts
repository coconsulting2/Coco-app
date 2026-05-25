/**
 * @module PrismaNotificationRepository
 * @description Adapter concreto del puerto `NotificationRepository` sobre Prisma
 * (capa infrastructure — único lugar del slice donde se toca Prisma). Mapea las
 * filas Prisma al shape de dominio que consumen los use-cases/componentes.
 */
import prisma from "~/platform/db/prisma.server.js";
import type { NotificationRepository } from "~/contexts/notifications/domain/ports/NotificationRepository.js";
import type {
  NotificationItem,
  NotificationPreferences,
  NotificationPreferencesPatch,
  WebPushSubscription,
} from "~/contexts/notifications/domain/entities/Notification.js";

type NotificationRow = {
  notificationId: number;
  message: string;
  isRead: boolean;
  createdAt: Date;
};

/**
 * `organizationId` (BigInt, requerido por el schema) lo inyecta el
 * `tenantExtension` de `@coco/db` en cada `create`/`upsert` — ver
 * `packages/db/src/tenant-extension.ts`. Los tipos estáticos de Prisma no lo
 * saben, así que casteamos el payload en este boundary infra (cast tolerado por
 * la regla 2: `as unknown as T` en frontera de infraestructura).
 */
function tenantData<T extends Record<string, unknown>>(data: T): never {
  return data as unknown as never;
}

function toItem(row: NotificationRow): NotificationItem {
  return {
    notificationId: row.notificationId,
    message: row.message,
    isRead: row.isRead,
    createdAt: row.createdAt.toISOString(),
  };
}

export class PrismaNotificationRepository implements NotificationRepository {
  async createForUser(userId: number, message: string): Promise<NotificationItem> {
    const row = (await prisma.notification.create({
      data: tenantData({ userId, message }),
    })) as NotificationRow;
    return toItem(row);
  }

  async listRecent(userId: number): Promise<NotificationItem[]> {
    const rows = (await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    })) as NotificationRow[];
    return rows.map(toItem);
  }

  async markRead(notificationId: number): Promise<NotificationItem> {
    const row = (await prisma.notification.update({
      where: { notificationId },
      data: { isRead: true },
    })) as NotificationRow;
    return toItem(row);
  }

  async countUnread(userId: number): Promise<number> {
    return prisma.notification.count({ where: { userId, isRead: false } });
  }

  async findPreferences(userId: number): Promise<NotificationPreferences | null> {
    const row = (await prisma.userPreference.findUnique({
      where: { userId },
    })) as NotificationPreferences | null;
    if (!row) return null;
    return {
      userId: row.userId,
      emailNotif: row.emailNotif,
      appNotif: row.appNotif,
      browserNotif: row.browserNotif,
    };
  }

  async upsertPreferences(
    userId: number,
    data: NotificationPreferencesPatch,
  ): Promise<NotificationPreferences> {
    const row = (await prisma.userPreference.upsert({
      where: { userId },
      update: data,
      create: tenantData({ userId, ...data }),
    })) as NotificationPreferences;
    return {
      userId: row.userId,
      emailNotif: row.emailNotif,
      appNotif: row.appNotif,
      browserNotif: row.browserNotif,
    };
  }

  async upsertPushSubscription(
    userId: number,
    subscription: WebPushSubscription,
  ): Promise<unknown> {
    const { endpoint, keys } = subscription;
    return prisma.pushSubscription.upsert({
      where: { userId_endpoint: { userId, endpoint } },
      update: { p256dh: keys.p256dh, auth: keys.auth },
      create: tenantData({ userId, endpoint, p256dh: keys.p256dh, auth: keys.auth }),
    });
  }
}
