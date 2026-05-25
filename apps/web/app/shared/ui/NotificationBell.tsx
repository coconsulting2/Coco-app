/**
 * Author: Hector Lugo
 * Description: NotificationBell para el header global (M3-006), migrado a RR7.
 *
 * Data por loader (resource route `/api/notifications/:userId`) consumida vía
 * `useFetcher` — CERO `fetch('/api/...')` ni `apiRequest`. La marca de leído
 * muta por `useFetcher` contra la misma resource route (`PUT .../:id/read`),
 * incluyendo el token CSRF (`_csrf`) leído de la cookie no-httpOnly `coco_csrf`.
 *
 * Prop-driven: recibe `initialNotifications` desde el loader que lo monta; si no
 * llegan, hace un `fetcher.load` inicial. Hace polling cada 30 s revalidando.
 */
import { useState, useEffect, useRef } from "react";
import { useFetcher } from "react-router";

import type { NotificationItem } from "~/contexts/notifications/index.js";

interface Props {
  userId: number | string;
  initialNotifications?: NotificationItem[];
}

const POLL_MS = 30_000;
const CSRF_COOKIE = "coco_csrf";

/** Lee la cookie CSRF (no httpOnly) en el navegador. SSR-safe (devuelve ""). */
function readCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${CSRF_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(CSRF_COOKIE.length + 1)) : "";
}

export default function NotificationBell({ userId, initialNotifications }: Props) {
  const listUrl = `/api/notifications/${userId}`;
  const listFetcher = useFetcher<NotificationItem[]>();
  const markFetcher = useFetcher();

  const [notifications, setNotifications] = useState<NotificationItem[]>(
    initialNotifications ?? [],
  );
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // `useFetcher()` devuelve un objeto nuevo en cada render; meter `listFetcher`
  // (o un callback que lo capture) en un dep array dispara el efecto en cada
  // render → loop infinito ("Maximum update depth exceeded"). Guardamos `load`
  // en un ref estable y el efecto depende solo de valores estables.
  const loadRef = useRef(listFetcher.load);
  loadRef.current = listFetcher.load;

  // Carga inicial (si no llegaron por prop) + polling.
  useEffect(() => {
    if (!userId) return;
    if (!initialNotifications) loadRef.current(listUrl);
    const interval = setInterval(() => loadRef.current(listUrl), POLL_MS);
    return () => clearInterval(interval);
  }, [userId, listUrl, initialNotifications]);

  // Sincroniza el estado local cuando llega data de la resource route.
  useEffect(() => {
    if (listFetcher.state === "idle" && Array.isArray(listFetcher.data)) {
      setNotifications(listFetcher.data);
    }
  }, [listFetcher.state, listFetcher.data]);

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
    // Optimista: marca en UI y muta vía resource route.
    setNotifications((prev) =>
      prev.map((n) =>
        n.notificationId === notificationId ? { ...n, isRead: true } : n,
      ),
    );
    markFetcher.submit(
      { _csrf: readCsrfToken() },
      { method: "put", action: `/api/notifications/${notificationId}/read` },
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
