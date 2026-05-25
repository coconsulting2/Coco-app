/**
 * @module PageHeader
 * @description Top navigation bar — Editorial Finance design system con
 * NotificationBell + logo + branding COCOAPI + role pill + logout + user avatar.
 * Réplica fiel del PageHeader.astro legacy.
 */
import { Link, useLocation } from "react-router";

import MaterialIcon from "~/shared/ui/MaterialIcon";
import LogoutButton from "~/shared/ui/Logout";
import NotificationBell from "~/shared/ui/NotificationBell";
import type { NotificationItem } from "~/contexts/notifications";

type Props = {
  userName: string;
  buttonLabel: string;
  notifications: NotificationItem[];
  csrfToken: string;
};

export default function PageHeader({ userName, buttonLabel, notifications, csrfToken }: Props) {
  const location = useLocation();
  const isCurrentRoute = location.pathname === "/perfil-usuario";

  const initials = userName
    .split(" ")
    .map((n) => n[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="flex min-h-14 flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b border-[var(--color-neutral-200)] bg-[var(--color-surface-white)] px-3 py-2 sm:px-4 md:h-14 md:flex-nowrap md:gap-x-3 md:px-6 md:py-0">
      {/* Left: Hamburger (mobile) + Logo + Brand */}
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 md:min-w-[auto] md:flex-none">
        <button
          id="menu-btn"
          type="button"
          className="md:hidden flex items-center justify-center w-11 h-11 rounded-[var(--radius-md)] hover:bg-[var(--color-surface-secondary)] transition-colors"
          aria-label="Abrir menú"
        >
          <MaterialIcon icon="menu" color="currentColor" />
        </button>
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <img src="/Logo.svg" className="w-9 h-9" alt="CocoAPI" />
          <span className="eyebrow text-[var(--color-ink)] tracking-widest font-semibold hidden sm:block">
            COCOAPI
          </span>
        </Link>
      </div>

      {/* Right: Role + Actions + User */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 md:gap-3">
        <span
          className="status-pill hidden max-w-[10rem] truncate border border-[var(--color-neutral-200)] bg-[var(--color-surface-secondary)] text-[var(--color-ink-secondary)] lg:inline-flex"
          title={buttonLabel}
        >
          {buttonLabel}
        </span>

        <div className="flex items-center gap-0.5 sm:gap-1">
          {/* NotificationBell: prop-driven desde el loader del layout (regla 4:
              shared/ui no hace fetch). Mark-read postea al action `/notificaciones`. */}
          <NotificationBell notifications={notifications} csrfToken={csrfToken} />
          <LogoutButton>
            <div className="p-2 rounded-[var(--radius-md)] text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-ink)] transition-colors cursor-pointer">
              <MaterialIcon icon="logout" color="currentColor" />
            </div>
          </LogoutButton>
        </div>

        <div className="flex items-center gap-2 border-[var(--color-neutral-200)] pl-1 sm:gap-3 sm:border-l sm:pl-2 md:pl-3">
          <span className="text-sm font-medium text-[var(--color-ink)] hidden md:block">
            {userName}
          </span>
          <Link
            to="/perfil-usuario"
            className={isCurrentRoute ? "pointer-events-none" : ""}
            aria-disabled={isCurrentRoute}
          >
            <div className="flex items-center justify-center rounded-full w-9 h-9 bg-primary-500 text-white cursor-pointer transition-all duration-200 hover:bg-primary-400">
              <span className="text-xs font-semibold">{initials}</span>
            </div>
          </Link>
        </div>
      </div>
    </header>
  );
}
