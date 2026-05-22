/**
 * @module Sidebar
 * @description Vertical sidebar — editorial style, blanco con 1px border,
 * hover states sutiles. Réplica fiel del Sidebar.astro legacy con:
 *   - data-collapsed toggle desktop con persistencia localStorage
 *   - Mobile drawer (oculto por default, abre con #menu-btn, cierra con overlay)
 *   - Eyebrow "Navegación"
 *   - MaterialIcon en cada item
 */
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";

import MaterialIcon from "~/shared/ui/MaterialIcon";
import { SIDEBAR_CONFIG, type MenuItem } from "@type/menu-config";
import type { UserRole } from "@type/roles";

type Props = { role: UserRole };

export default function Sidebar({ role }: Props) {
  const location = useLocation();
  const items: MenuItem[] = SIDEBAR_CONFIG[role] ?? [];

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Hydrate localStorage state desktop-only.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(min-width: 768px)").matches) return;
    try {
      setCollapsed(localStorage.getItem("sidebar-collapsed") === "true");
    } catch {
      /* ignore */
    }
  }, []);

  // Wire mobile hamburger (#menu-btn) and overlay click.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const menuBtn = document.getElementById("menu-btn");
    const overlay = document.getElementById("sidebar-overlay");
    const onMenuClick = () => setMobileOpen((v) => !v);
    const onOverlayClick = () => setMobileOpen(false);
    menuBtn?.addEventListener("click", onMenuClick);
    overlay?.addEventListener("click", onOverlayClick);
    return () => {
      menuBtn?.removeEventListener("click", onMenuClick);
      overlay?.removeEventListener("click", onOverlayClick);
    };
  }, []);

  // Sync mobile open state to overlay element.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const overlay = document.getElementById("sidebar-overlay");
    if (!overlay) return;
    overlay.classList.toggle("open", mobileOpen);
  }, [mobileOpen]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar-collapsed", next ? "true" : "false");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <aside
      id="sidebar-panel"
      data-collapsed={collapsed ? "true" : "false"}
      data-mobile-open={mobileOpen ? "true" : "false"}
      className={[
        "relative flex h-full flex-col overflow-hidden",
        "bg-[var(--color-surface-white)] border-r border-[var(--color-neutral-200)]",
        "transition-[width] duration-300 ease-in-out",
        collapsed ? "w-20" : "w-64 md:w-72",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3 px-3 pt-4">
        {!collapsed && (
          <p className="sidebar-eyebrow eyebrow px-3 mb-0">Navegación</p>
        )}

        <button
          id="sidebar-toggle"
          type="button"
          onClick={toggleCollapsed}
          className="hidden md:flex h-10 w-10 shrink-0 items-center justify-center rounded-md hover:bg-[var(--color-surface-secondary)] transition-colors"
          aria-controls="sidebar-panel"
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}
        >
          <MaterialIcon
            icon={collapsed ? "chevron_right" : "chevron_left"}
            color="var(--color-ink-muted)"
          />
        </button>
      </div>

      <button
        id="sidebar-close"
        type="button"
        onClick={() => setMobileOpen(false)}
        className="md:hidden absolute top-3 right-3 w-11 h-11 flex items-center justify-center rounded-md hover:bg-[var(--color-surface-secondary)] transition-colors"
        aria-label="Cerrar barra lateral"
      >
        <MaterialIcon icon="close" color="var(--color-ink-muted)" />
      </button>

      <div className="flex-1 px-3 py-4 overflow-auto">
        <ul className="sidebar-nav space-y-1 font-medium list-none p-0 m-0">
          {items.map((item) => {
            const isActive = location.pathname.startsWith(item.route);
            return (
              <li key={item.route}>
                <Link
                  to={item.route}
                  className={[
                    "sidebar-action flex items-center gap-3 w-full min-w-0 px-3 py-2.5 rounded-md transition-colors duration-150 group",
                    isActive
                      ? "bg-primary-50 text-primary-500 pointer-events-none font-medium"
                      : "text-ink-secondary hover:bg-[var(--color-surface-secondary)] hover:text-ink",
                  ].join(" ")}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className="sidebar-icon flex items-center justify-center w-5 h-5 shrink-0">
                    <MaterialIcon
                      icon={item.icon}
                      color={isActive ? "var(--color-primary-500)" : "currentColor"}
                    />
                  </span>
                  <span className="sidebar-label truncate text-sm">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
