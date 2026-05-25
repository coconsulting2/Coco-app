/**
 * Unit tests de los use-cases del slice notifications con stubs de los ports
 * `NotificationRepository` y `PushSender` — sin DB ni `web-push`. Cubre paridad
 * con el controller legacy `notificationController.js`: list, mark-read,
 * unread-count, preferences (get/set), subscribe, vapid-public-key y el
 * side-effect `createNotification` (in-app + push según preferencias).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  createNotification,
  listNotifications,
  markNotificationRead,
  getUnreadCount,
  getNotificationPreferences,
  setNotificationPreferences,
  subscribePush,
  getVapidPublicKey,
} from "~/contexts/notifications/application/notificationService";
import type { NotificationRepository } from "~/contexts/notifications/domain/ports/NotificationRepository";
import type { PushSender } from "~/contexts/notifications/domain/ports/PushSender";
import type {
  NotificationItem,
  NotificationPreferences,
} from "~/contexts/notifications/domain/entities/Notification";

function makeItem(over: Partial<NotificationItem> = {}): NotificationItem {
  return {
    notificationId: 1,
    message: "Hola",
    isRead: false,
    createdAt: "2026-05-25T00:00:00.000Z",
    ...over,
  };
}

function makeRepo(over: Partial<NotificationRepository> = {}): NotificationRepository {
  return {
    createForUser: vi.fn(async (_userId: number, message: string) => makeItem({ message })),
    listRecent: vi.fn(async () => [makeItem()]),
    markRead: vi.fn(async (notificationId: number) => makeItem({ notificationId, isRead: true })),
    countUnread: vi.fn(async () => 3),
    findPreferences: vi.fn(async () => null),
    upsertPreferences: vi.fn(
      async (userId: number, data): Promise<NotificationPreferences> => ({
        userId,
        emailNotif: data.emailNotif ?? true,
        appNotif: data.appNotif ?? true,
        browserNotif: data.browserNotif ?? true,
      }),
    ),
    upsertPushSubscription: vi.fn(async () => ({ ok: true })),
    ...over,
  };
}

function makePush(over: Partial<PushSender> = {}): PushSender {
  return {
    getVapidPublicKey: vi.fn(() => "VAPID_PUB"),
    sendWebPush: vi.fn(async () => undefined),
    ...over,
  };
}

describe("notifications use-cases", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listNotifications delega en repo.listRecent", async () => {
    const repo = makeRepo();
    const result = await listNotifications(7, { repo });
    expect(repo.listRecent).toHaveBeenCalledWith(7);
    expect(result).toHaveLength(1);
  });

  it("markNotificationRead delega en repo.markRead", async () => {
    const repo = makeRepo();
    const result = await markNotificationRead(42, { repo });
    expect(repo.markRead).toHaveBeenCalledWith(42);
    expect(result.isRead).toBe(true);
  });

  it("getUnreadCount devuelve el conteo del repo", async () => {
    const repo = makeRepo();
    expect(await getUnreadCount(7, { repo })).toBe(3);
    expect(repo.countUnread).toHaveBeenCalledWith(7);
  });

  it("getNotificationPreferences devuelve defaults cuando no hay fila", async () => {
    const repo = makeRepo({ findPreferences: vi.fn(async () => null) });
    const prefs = await getNotificationPreferences(9, { repo });
    expect(prefs).toEqual({ userId: 9, emailNotif: true, appNotif: true, browserNotif: true });
  });

  it("getNotificationPreferences devuelve la fila persistida si existe", async () => {
    const repo = makeRepo({
      findPreferences: vi.fn(async () => ({
        userId: 9,
        emailNotif: false,
        appNotif: true,
        browserNotif: false,
      })),
    });
    const prefs = await getNotificationPreferences(9, { repo });
    expect(prefs.emailNotif).toBe(false);
    expect(prefs.browserNotif).toBe(false);
  });

  it("setNotificationPreferences delega en repo.upsertPreferences", async () => {
    const repo = makeRepo();
    const prefs = await setNotificationPreferences(9, { emailNotif: false }, { repo });
    expect(repo.upsertPreferences).toHaveBeenCalledWith(9, { emailNotif: false });
    expect(prefs.emailNotif).toBe(false);
  });

  it("subscribePush delega en repo.upsertPushSubscription", async () => {
    const repo = makeRepo();
    const sub = { endpoint: "https://push", keys: { p256dh: "p", auth: "a" } };
    await subscribePush(9, sub, { repo });
    expect(repo.upsertPushSubscription).toHaveBeenCalledWith(9, sub);
  });

  it("getVapidPublicKey devuelve la key del PushSender", () => {
    const push = makePush();
    expect(getVapidPublicKey({ push })).toBe("VAPID_PUB");
  });

  describe("createNotification", () => {
    it("crea in-app y dispara push cuando ambas prefs están activas (default)", async () => {
      const repo = makeRepo({ findPreferences: vi.fn(async () => null) });
      const push = makePush();
      const result = await createNotification(5, "msg", { repo, push });
      expect(repo.createForUser).toHaveBeenCalledWith(5, "msg");
      expect(push.sendWebPush).toHaveBeenCalledWith(5, "msg");
      expect(result?.message).toBe("msg");
    });

    it("omite in-app cuando appNotif=false pero igual hace push si browserNotif=true", async () => {
      const repo = makeRepo({
        findPreferences: vi.fn(async () => ({
          userId: 5,
          emailNotif: true,
          appNotif: false,
          browserNotif: true,
        })),
      });
      const push = makePush();
      const result = await createNotification(5, "msg", { repo, push });
      expect(repo.createForUser).not.toHaveBeenCalled();
      expect(push.sendWebPush).toHaveBeenCalledWith(5, "msg");
      expect(result).toBeNull();
    });

    it("omite push cuando browserNotif=false", async () => {
      const repo = makeRepo({
        findPreferences: vi.fn(async () => ({
          userId: 5,
          emailNotif: true,
          appNotif: true,
          browserNotif: false,
        })),
      });
      const push = makePush();
      await createNotification(5, "msg", { repo, push });
      expect(repo.createForUser).toHaveBeenCalledWith(5, "msg");
      expect(push.sendWebPush).not.toHaveBeenCalled();
    });

    it("no propaga errores de push (resiliencia in-app)", async () => {
      const repo = makeRepo({ findPreferences: vi.fn(async () => null) });
      const push = makePush({
        sendWebPush: vi.fn(async () => {
          throw new Error("web push down");
        }),
      });
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const result = await createNotification(5, "msg", { repo, push });
      expect(result?.message).toBe("msg");
      expect(errSpy).toHaveBeenCalled();
      errSpy.mockRestore();
    });
  });
});
