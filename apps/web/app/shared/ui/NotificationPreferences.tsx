/**
 * @module NotificationPreferences
 * @description Preferencias de notificación del usuario (M3-006), prop-driven.
 * Recibe las preferencias iniciales + la VAPID public key por prop desde el
 * loader de `/perfil-usuario` (regla 4: ningún fetch a /api/*). Muta vía
 * `useFetcher` contra la `action` de esa misma ruta con los intents
 * `save-preferences` y `subscribe-push`. El refresco lo hace RR7 al revalidar.
 *
 * Paridad 1:1 con el legacy `components/NotificationPreferences.tsx`:
 *   - 3 toggles (email, in-app, browser/web push).
 *   - Al activar "browser", solicita permiso de Notification, registra el
 *     service worker `/sw.js`, se suscribe a pushManager con la VAPID key y
 *     manda la suscripción al backend (intent `subscribe-push`).
 */
import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

export type NotificationPrefs = {
  emailNotif: boolean;
  appNotif: boolean;
  browserNotif: boolean;
};

type Props = {
  prefs: NotificationPrefs;
  vapidPublicKey: string;
  csrfToken: string;
};

type PrefKey = keyof NotificationPrefs;

const ITEMS: { key: PrefKey; label: string; desc: string }[] = [
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

export default function NotificationPreferences({ prefs, vapidPublicKey, csrfToken }: Props) {
  const [local, setLocal] = useState<NotificationPrefs>(prefs);
  const [pushPermission, setPushPermission] = useState<string>("default");
  const fetcher = useFetcher();
  const saving = fetcher.state !== "idle";

  // Reconcilia con el server cuando el loader revalida (props nuevas).
  useEffect(() => {
    setLocal(prefs);
  }, [prefs]);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPushPermission(Notification.permission);
    }
  }, []);

  const persist = (next: NotificationPrefs, key: PrefKey) => {
    fetcher.submit(
      {
        _intent: "save-preferences",
        _csrf: csrfToken,
        emailNotif: String(next.emailNotif),
        appNotif: String(next.appNotif),
        browserNotif: String(next.browserNotif),
      },
      { method: "post" },
    );
    if (key === "browserNotif" && next.browserNotif) {
      void requestPushPermission();
    }
  };

  const updatePref = (key: PrefKey, value: boolean) => {
    const next = { ...local, [key]: value };
    setLocal(next);
    persist(next, key);
  };

  const requestPushPermission = async () => {
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }
    const permission = await Notification.requestPermission();
    setPushPermission(permission);
    if (permission !== "granted" || !vapidPublicKey) return;

    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidPublicKey,
      });
      fetcher.submit(
        {
          _intent: "subscribe-push",
          _csrf: csrfToken,
          subscription: JSON.stringify(subscription.toJSON()),
        },
        { method: "post" },
      );
    } catch (err) {
      console.error("Error subscribing to push:", err);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {ITEMS.map((item) => (
        <PrefRow
          key={item.key}
          label={item.label}
          desc={item.desc}
          enabled={local[item.key]}
          saving={saving}
          showDeniedHint={item.key === "browserNotif" && pushPermission === "denied"}
          onToggle={() => updatePref(item.key, !local[item.key])}
        />
      ))}
    </div>
  );
}

function PrefRow({
  label,
  desc,
  enabled,
  saving,
  showDeniedHint,
  onToggle,
}: {
  label: string;
  desc: string;
  enabled: boolean;
  saving: boolean;
  showDeniedHint: boolean;
  onToggle: () => void;
}) {
  const liveRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--color-ink)]">{label}</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--color-ink-muted)]">{desc}</p>
        {showDeniedHint && (
          <p className="mt-1.5 text-[11px] font-medium text-[var(--color-error,#ef4444)]">
            Permiso bloqueado en el navegador. Habilítalo desde la configuración del sitio.
          </p>
        )}
      </div>
      <button
        ref={liveRef}
        type="button"
        onClick={onToggle}
        disabled={saving}
        aria-label={`${enabled ? "Desactivar" : "Activar"} ${label}`}
        aria-pressed={enabled}
        className="relative h-6 w-11 shrink-0 rounded-full border-none p-0 transition-colors disabled:cursor-wait"
        style={{
          background: enabled
            ? "var(--color-primary-500, #3b82f6)"
            : "var(--color-neutral-300, #d1d5db)",
          cursor: saving ? "wait" : "pointer",
        }}
      >
        <span
          className="absolute top-[3px] block h-[18px] w-[18px] rounded-full bg-white shadow transition-[left]"
          style={{ left: enabled ? "23px" : "3px" }}
        />
      </button>
    </div>
  );
}
