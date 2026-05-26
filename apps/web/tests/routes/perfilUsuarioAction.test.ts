/**
 * Unit tests de la `action` de la ruta `/perfil-usuario` (preferencias de
 * notificación). Mockea los boundaries de plataforma (sesión, CSRF) y los
 * use-cases del slice notifications, y verifica que cada intent
 * (`save-preferences`, `subscribe-push`) delega con los args correctos +
 * exige CSRF, además del manejo de inputs inválidos. Sin DB ni servidor.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  requireSession,
  runInTenant,
  assertCsrf,
  issueCsrfToken,
  setNotificationPreferences,
  subscribePush,
  getNotificationPreferences,
  getVapidPublicKey,
} = vi.hoisted(() => {
  const session = {
    user: { user_id: 42, username: "ana", role: "Solicitante", organization_id: "1" },
  };
  return {
    requireSession: vi.fn(async () => session),
    runInTenant: vi.fn(async (_s: unknown, work: () => Promise<unknown>) => work()),
    assertCsrf: vi.fn(async () => undefined),
    issueCsrfToken: vi.fn(() => ({ token: "csrf-123", setCookie: "csrf=abc" })),
    setNotificationPreferences: vi.fn(async (_userId: number, patch: unknown) => ({
      userId: 42,
      emailNotif: true,
      appNotif: true,
      browserNotif: true,
      ...(patch as object),
    })),
    subscribePush: vi.fn(async () => ({ ok: true })),
    getNotificationPreferences: vi.fn(async () => ({
      userId: 42,
      emailNotif: true,
      appNotif: true,
      browserNotif: true,
    })),
    getVapidPublicKey: vi.fn(() => "vapid-public-key"),
  };
});

vi.mock("~/platform/session/requireUser.server", () => ({
  requireSession,
  runInTenant,
}));
vi.mock("~/platform/session/session.server", () => ({
  buildLogoutCookies: () => ["token=; Max-Age=0"],
}));
vi.mock("~/platform/csrf/csrf.server", () => ({
  assertCsrf,
  issueCsrfToken,
}));
vi.mock("~/contexts/identity", () => ({
  getUserProfile: vi.fn(),
  UserNotFoundError: class UserNotFoundError extends Error {},
}));
vi.mock("~/contexts/notifications", () => ({
  getNotificationPreferences,
  getVapidPublicKey,
  setNotificationPreferences,
  subscribePush,
}));
// El componente importa react-router/useFetcher; evitamos cargarlo en el test
// de la action (solo necesitamos loader/action del módulo de ruta).
vi.mock("~/shared/ui/NotificationPreferences", () => ({ default: () => null }));

import { action } from "~/routes/_app/perfil-usuario";

function makeRequest(body: Record<string, string>): Request {
  const form = new URLSearchParams(body);
  return new Request("https://app.test/perfil-usuario", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("perfil-usuario action", () => {
  it("intent save-preferences: exige CSRF y delega el patch a setNotificationPreferences", async () => {
    const request = makeRequest({
      _intent: "save-preferences",
      _csrf: "csrf-123",
      emailNotif: "false",
      appNotif: "true",
      browserNotif: "false",
    });

    const result = (await action({ request, params: {}, context: {} } as never)) as {
      ok: boolean;
      intent: string;
    };

    expect(assertCsrf).toHaveBeenCalledWith(request);
    expect(setNotificationPreferences).toHaveBeenCalledTimes(1);
    expect(setNotificationPreferences).toHaveBeenCalledWith(42, {
      emailNotif: false,
      appNotif: true,
      browserNotif: false,
    });
    expect(result.ok).toBe(true);
    expect(result.intent).toBe("save-preferences");
  });

  it("intent save-preferences: omite flags ausentes en el patch", async () => {
    const request = makeRequest({
      _intent: "save-preferences",
      _csrf: "csrf-123",
      browserNotif: "true",
    });

    await action({ request, params: {}, context: {} } as never);

    expect(setNotificationPreferences).toHaveBeenCalledWith(42, { browserNotif: true });
  });

  it("intent subscribe-push: parsea la suscripción y delega a subscribePush", async () => {
    const subscription = {
      endpoint: "https://push.example/abc",
      keys: { p256dh: "p256", auth: "auth" },
    };
    const request = makeRequest({
      _intent: "subscribe-push",
      _csrf: "csrf-123",
      subscription: JSON.stringify(subscription),
    });

    const result = (await action({ request, params: {}, context: {} } as never)) as {
      ok: boolean;
      intent: string;
    };

    expect(assertCsrf).toHaveBeenCalledWith(request);
    expect(subscribePush).toHaveBeenCalledWith(42, subscription);
    expect(result.ok).toBe(true);
    expect(result.intent).toBe("subscribe-push");
  });

  it("intent subscribe-push: rechaza suscripción inválida sin llamar al use-case", async () => {
    const request = makeRequest({
      _intent: "subscribe-push",
      _csrf: "csrf-123",
      subscription: JSON.stringify({ endpoint: "x" }),
    });

    const result = (await action({ request, params: {}, context: {} } as never)) as {
      ok: boolean;
      error: string;
    };

    expect(result.ok).toBe(false);
    expect(subscribePush).not.toHaveBeenCalled();
  });

  it("propaga el fallo de assertCsrf (CSRF inválido)", async () => {
    assertCsrf.mockRejectedValueOnce(new Error("CSRF inválido"));
    const request = makeRequest({
      _intent: "save-preferences",
      _csrf: "bad",
      emailNotif: "true",
    });

    await expect(
      action({ request, params: {}, context: {} } as never),
    ).rejects.toThrow("CSRF inválido");
    expect(setNotificationPreferences).not.toHaveBeenCalled();
  });
});
