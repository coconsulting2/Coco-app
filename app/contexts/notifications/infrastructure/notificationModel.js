/**
 * @module notificationModel
 * @description Repositorio de notificaciones y preferencias. ÚNICO archivo
 * del slice notifications que toca Prisma — extracción del legacy
 * notificationService.js que importaba prisma desde application/.
 *
 * Esta es la demostración del refactor "Fase 6 hardening": cada slice legacy
 * con prisma inline en application/ debe replicar este patrón. Ver
 * CLEANUP_PLAN.md §1.
 */
import prisma from "~/platform/db/prisma.server.js";

const NotificationModel = {
  /**
   * Crea una notificación en BD para el usuario.
   * @param {number} userId
   * @param {string} message
   * @returns {Promise<object>}
   */
  async createForUser(userId, message) {
    return prisma.notification.create({
      data: { userId, message },
    });
  },

  /**
   * Lista las últimas 50 notificaciones del usuario, más recientes primero.
   * @param {number} userId
   * @returns {Promise<object[]>}
   */
  async listRecent(userId) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  },

  /**
   * Marca una notificación como leída.
   * @param {number} notificationId
   * @returns {Promise<object>}
   */
  async markRead(notificationId) {
    return prisma.notification.update({
      where: { notificationId },
      data: { isRead: true },
    });
  },

  /**
   * Conteo de no leídas del usuario.
   * @param {number} userId
   * @returns {Promise<number>}
   */
  async countUnread(userId) {
    return prisma.notification.count({
      where: { userId, isRead: false },
    });
  },

  /**
   * Preferencias del usuario o null si no existen.
   * @param {number} userId
   * @returns {Promise<object|null>}
   */
  async findPreferences(userId) {
    return prisma.userPreference.findUnique({ where: { userId } });
  },

  /**
   * Upsert de preferencias.
   * @param {number} userId
   * @param {{ emailNotif?: boolean; appNotif?: boolean; browserNotif?: boolean }} data
   * @returns {Promise<object>}
   */
  async upsertPreferences(userId, data) {
    return prisma.userPreference.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  },

  /**
   * Upsert de subscription Web Push.
   * @param {number} userId
   * @param {{ endpoint: string; keys: { p256dh: string; auth: string } }} subscription
   * @returns {Promise<object>}
   */
  async upsertPushSubscription(userId, subscription) {
    const { endpoint, keys } = subscription;
    return prisma.pushSubscription.upsert({
      where: { userId_endpoint: { userId, endpoint } },
      update: { p256dh: keys.p256dh, auth: keys.auth },
      create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    });
  },
};

export default NotificationModel;
