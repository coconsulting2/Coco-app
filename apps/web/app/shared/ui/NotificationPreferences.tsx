/**
 * Author: Hector Lugo
 * Description: NotificationPreferences para el perfil (M3-006), migrado a RR7.
 *
 * Data por loader (resource route `/api/notifications/preferences/:userId`)
 * consumida vía `useFetcher` — CERO `fetch('/api/...')` ni `apiRequest`. Mutación
 * de preferencias y suscripción Web Push también por `useFetcher` contra las
 * resource routes del slice (PUT preferences / GET vapid-public-key / POST
 * subscribe), incluyendo el token CSRF (`_csrf`) leído de la cookie `coco_csrf`.
 *
 * Decisión Web Push (regla 4): las APIs del navegador (vapid-public-key /
 * subscribe) se sirven como resource route RR7 (no fetch a backend externo). La
 * registración del Service Worker (`navigator.serviceWorker.register`) y
 * `Notification.requestPermission` / `pushManager.subscribe` son APIs del
 * navegador client-side, NO fetch a `/api/*`.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useFetcher } from "react-router";

import type { NotificationPreferences } from "~/contexts/notifications/index.js";

type Prefs = Pick<NotificationPreferences, "emailNotif" | "appNotif" | "browserNotif">;

interface Props {
  userId: number | string;
  initialPrefs?: Prefs;
}

const CSRF_COOKIE = "coco_csrf";

/** Lee la cookie CSRF (no httpOnly) en el navegador. SSR-safe (devuelve ""). */
function readCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${CSRF_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(CSRF_COOKIE.length + 1)) : "";
}

const DEFAULT_PREFS: Prefs = { emailNotif: true, appNotif: true, browserNotif: true };

export default function NotificationPreferences({ userId, initialPrefs }: Props) {
  const prefsUrl = `/api/notifications/preferences/${userId}`;
  const prefsFetcher = useFetcher<NotificationPreferences>();
  const saveFetcher = useFetcher<NotificationPreferences>();
  const vapidFetcher = useFetcher<{ key: string }>();
  const subscribeFetcher = useFetcher();

  const [prefs, setPrefs] = useState<Prefs>(initialPrefs ?? DEFAULT_PREFS);
  const [pushPermission, setPushPermission] = useState<string>("default");
  const saving = saveFetcher.state !== "idle";

  // `useFetcher()` devuelve objeto nuevo en cada render; meterlo en un dep array
  // dispara el efecto en cada render → loop ("Maximum update depth exceeded").
  // Guardamos los métodos en refs estables.
  const prefsLoadRef = useRef(prefsFetcher.load);
  prefsLoadRef.current = prefsFetcher.load;
  const vapidLoadRef = useRef(vapidFetcher.load);
  vapidLoadRef.current = vapidFetcher.load;
  const subscribeSubmitRef = useRef(subscribeFetcher.submit);
  subscribeSubmitRef.current = subscribeFetcher.submit;

  // Carga inicial de preferencias (si no llegaron por prop).
  useEffect(() => {
    if (!userId) return;
    if (!initialPrefs) prefsLoadRef.current(prefsUrl);
    if (typeof window !== "undefined" && "Notification" in window) {
      setPushPermission(Notification.permission);
    }
  }, [userId, initialPrefs, prefsUrl]);

  // Sincroniza al recibir data de la resource route.
  useEffect(() => {
    if (prefsFetcher.state === "idle" && prefsFetcher.data) {
      const d = prefsFetcher.data;
      setPrefs({
        emailNotif: d.emailNotif ?? true,
        appNotif: d.appNotif ?? true,
        browserNotif: d.browserNotif ?? true,
      });
    }
  }, [prefsFetcher.state, prefsFetcher.data]);

  // Cuando llega la VAPID key, dispara la suscripción del navegador.
  const subscribeWithVapid = useCallback(
    async (vapidKey: string) => {
      if (!vapidKey) return;
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        return;
      }
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKey,
        });
        subscribeSubmitRef.current(
          { _csrf: readCsrfToken(), subscription: JSON.stringify(subscription.toJSON()) },
          { method: "post", action: "/api/notifications/subscribe" },
        );
      } catch (err) {
        console.error("Error subscribing to push:", err);
      }
    },
    [],
  );

  useEffect(() => {
    if (vapidFetcher.state === "idle" && vapidFetcher.data?.key) {
      void subscribeWithVapid(vapidFetcher.data.key);
    }
  }, [vapidFetcher.state, vapidFetcher.data, subscribeWithVapid]);

  const requestPushPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
      console.warn("Push notifications not supported in this browser");
      return;
    }
    const permission = await Notification.requestPermission();
    setPushPermission(permission);
    if (permission !== "granted") return;
    // Pide la VAPID key vía resource route; el efecto de arriba completa la suscripción.
    vapidLoadRef.current("/api/notifications/vapid-public-key");
  }, []);

  const updatePref = (key: keyof Prefs, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    saveFetcher.submit(
      { _csrf: readCsrfToken(), [key]: String(value) },
      { method: "put", action: prefsUrl },
    );
    if (key === "browserNotif" && value) {
      void requestPushPermission();
    }
  };

  const items: { key: keyof Prefs; label: string; desc: string }[] = [
    {
      key: "emailNotif",
      label: "Correo electrónico",
      desc: "Recibe alertas por correo electrónico cuando cambie el estado de tus solicitudes.",
    },
    {
      key: "appNotif",
      label: "Notificaciones in-app",
      desc: "Muestra las alertas en la campanita del menú superior.",
    },
    {
      key: "browserNotif",
      label: "Notificaciones del navegador",
      desc: "Recibe alertas push del sistema operativo incluso si la pestaña está en segundo plano.",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {items.map((item) => (
        <div
          key={item.key}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "16px",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontSize: "14px",
                fontWeight: 500,
                color: "var(--color-ink, #111827)",
              }}
            >
              {item.label}
            </p>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: "12px",
                color: "var(--color-ink-muted, #6b7280)",
                lineHeight: 1.5,
              }}
            >
              {item.desc}
            </p>
            {item.key === "browserNotif" && pushPermission === "denied" && (
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: "11px",
                  color: "var(--color-error, #ef4444)",
                  fontWeight: 500,
                }}
              >
                Permiso bloqueado en el navegador. Habilítalo desde la configuración del sitio.
              </p>
            )}
          </div>
          {/* Toggle switch */}
          <button
            type="button"
            onClick={() => updatePref(item.key, !prefs[item.key])}
            disabled={saving}
            aria-label={`${prefs[item.key] ? "Desactivar" : "Activar"} ${item.label}`}
            style={{
              position: "relative",
              width: "44px",
              height: "24px",
              borderRadius: "9999px",
              border: "none",
              padding: 0,
              cursor: saving ? "wait" : "pointer",
              background: prefs[item.key]
                ? "var(--color-primary-500, #3b82f6)"
                : "var(--color-neutral-300, #d1d5db)",
              transition: "background 0.2s",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                display: "block",
                width: "18px",
                height: "18px",
                borderRadius: "50%",
                background: "#fff",
                boxShadow: "0 1px 3px rgba(0,0,0,.15)",
                position: "absolute",
                top: "3px",
                left: prefs[item.key] ? "23px" : "3px",
                transition: "left 0.2s",
              }}
            />
          </button>
        </div>
      ))}
    </div>
  );
}
