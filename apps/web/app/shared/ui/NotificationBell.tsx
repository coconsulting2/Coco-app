/**
 * Author: Hector Lugo
 * Description: NotificationBell para el header global (M3-006), migrado a RR7.
 *
 * Prop-driven (regla 4: shared/ui NO hace fetch a `/api/*`): la lista
 * `notifications` y el `csrfToken` llegan por prop desde el loader del layout
 * `_app/_layout`. La marca de leído se postea con `useFetcher` al `action` de la
 * ruta RR `/notificaciones` (no `/api`); la revalidación re-corre el loader del
 * layout y refresca la lista. Estado local solo para el update optimista.
 */
import { useState, useEffect, useRef } from "react";
import { useFetcher } from "react-router";

import type { NotificationItem } from "~/contexts/notifications/index.js";

interface Props {
  /** Lista provista por el loader del layout `_app/_layout` (regla 4: shared/ui
   *  no hace fetch; los datos llegan por prop). */
  notifications: NotificationItem[];
  /** Token CSRF emitido por el loader del layout para el POST de mark-read. */
  csrfToken: string;
}

export default function NotificationBell({ notifications: loaded, csrfToken }: Props) {
  const markFetcher = useFetcher();

  // Estado local solo para el update optimista al marcar como leído; se
  // re-sincroniza cuando el loader revalida tras la mutación.
  const [notifications, setNotifications] = useState<NotificationItem[]>(loaded);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // `loaded` es data de loader (referencia estable hasta una revalidación): el
  // efecto re-sincroniza el estado local sin loop.
  useEffect(() => {
    setNotifications(loaded);
  }, [loaded]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Cierra el dropdown al hacer click fuera.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAsRead = (notificationId: number) => {
    // Optimista en UI; muta vía el action de la ruta RR `/notificaciones`
    // (regla 4: nada de `/api/*` desde shared/ui). La revalidación re-corre el
    // loader del layout y re-sincroniza la lista.
    setNotifications((prev) =>
      prev.map((n) =>
        n.notificationId === notificationId ? { ...n, isRead: true } : n,
      ),
    );
    markFetcher.submit(
      { intent: "mark-read", notificationId: String(notificationId), _csrf: csrfToken },
      { method: "post", action: "/notificaciones" },
    );
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Ahora";
    if (diffMin < 60) return `hace ${diffMin}m`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `hace ${diffHrs}h`;
    return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  };

  return (
    <div ref={dropdownRef} style={{ position: "relative", display: "inline-flex" }}>
      {/* Bell button */}
      <button
        id="notification-bell-btn"
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notificaciones"
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "2.25rem",
          height: "2.25rem",
          borderRadius: "var(--radius-md, 0.5rem)",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          color: "var(--color-ink-muted, #6b7280)",
          transition: "background 0.15s, color 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "var(--color-surface-secondary, #f3f4f6)";
          (e.currentTarget as HTMLElement).style.color = "var(--color-ink, #111827)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "transparent";
          (e.currentTarget as HTMLElement).style.color = "var(--color-ink-muted, #6b7280)";
        }}
      >
        {/* Bell SVG */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {/* Badge */}
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: "2px",
              right: "2px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "16px",
              height: "16px",
              borderRadius: "9999px",
              background: "var(--color-error, #ef4444)",
              color: "#fff",
              fontSize: "10px",
              fontWeight: 700,
              lineHeight: 1,
              padding: "0 4px",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          id="notification-dropdown"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: "360px",
            maxHeight: "420px",
            overflowY: "auto",
            background: "var(--color-surface-white, #fff)",
            border: "1px solid var(--color-neutral-200, #e5e7eb)",
            borderRadius: "var(--radius-lg, 0.75rem)",
            boxShadow: "0 10px 25px -5px rgba(0,0,0,.1), 0 4px 6px -2px rgba(0,0,0,.05)",
            zIndex: 100,
          }}
        >
          <div
            style={{
              padding: "14px 16px 10px",
              borderBottom: "1px solid var(--color-neutral-200, #e5e7eb)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontWeight: 600, fontSize: "14px", color: "var(--color-ink, #111827)" }}>
              Notificaciones
            </span>
            {unreadCount > 0 && (
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--color-primary-500, #3b82f6)",
                  background: "var(--color-primary-50, #eff6ff)",
                  padding: "2px 8px",
                  borderRadius: "9999px",
                }}
              >
                {unreadCount} sin leer
              </span>
            )}
          </div>

          {notifications.length === 0 ? (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--color-ink-muted, #9ca3af)", fontSize: "13px" }}>
              No tienes notificaciones
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.notificationId}
                type="button"
                onClick={() => !n.isRead && markAsRead(n.notificationId)}
                style={{
                  display: "flex",
                  width: "100%",
                  alignItems: "flex-start",
                  gap: "10px",
                  padding: "12px 16px",
                  border: "none",
                  borderBottom: "1px solid var(--color-neutral-100, #f3f4f6)",
                  background: n.isRead
                    ? "transparent"
                    : "var(--color-primary-50, #eff6ff)",
                  cursor: n.isRead ? "default" : "pointer",
                  textAlign: "left",
                  transition: "background 0.15s",
                }}
              >
                {/* Unread dot */}
                <span
                  style={{
                    marginTop: "6px",
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: n.isRead
                      ? "var(--color-neutral-300, #d1d5db)"
                      : "var(--color-primary-500, #3b82f6)",
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      fontWeight: n.isRead ? 400 : 500,
                      color: "var(--color-ink, #111827)",
                      lineHeight: 1.4,
                    }}
                  >
                    {n.message}
                  </p>
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: "11px",
                      color: "var(--color-ink-muted, #9ca3af)",
                    }}
                  >
                    {formatTime(n.createdAt)}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
