// @ts-nocheck — slice partially typed; pre-existing Prisma mismatches
/**
 * @module notificationModel
 * @description Repositorio de notificaciones y preferencias.
 */
import prisma from "~/platform/db/prisma.server.js";

const NotificationModel = {
  async createForUser(userId: number, message: string): Promise<unknown> {
    return prisma.notification.create({
      data: { userId, message },
    });
  },

  async listRecent(userId: number): Promise<unknown[]> {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  },

  async markRead(notificationId: number): Promise<unknown> {
    return prisma.notification.update({
      where: { notificationId },
      data: { isRead: true },
    });
  },

  async countUnread(userId: number): Promise<number> {
    return prisma.notification.count({
      where: { userId, isRead: false },
    });
  },

  async findPreferences(userId: number): Promise<{
    userId: number;
    emailNotif: boolean;
    appNotif: boolean;
    browserNotif: boolean;
  } | null> {
    return prisma.userPreference.findUnique({ where: { userId } }) as Promise<{
      userId: number;
      emailNotif: boolean;
      appNotif: boolean;
      browserNotif: boolean;
    } | null>;
  },

  async upsertPreferences(
    userId: number,
    data: { emailNotif?: boolean; appNotif?: boolean; browserNotif?: boolean },
  ): Promise<unknown> {
    return prisma.userPreference.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  },

  async upsertPushSubscription(
    userId: number,
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  ): Promise<unknown> {
    const { endpoint, keys } = subscription;
    return prisma.pushSubscription.upsert({
      where: { userId_endpoint: { userId, endpoint } },
      update: { p256dh: keys.p256dh, auth: keys.auth },
      create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    });
  },
};

export default NotificationModel;
