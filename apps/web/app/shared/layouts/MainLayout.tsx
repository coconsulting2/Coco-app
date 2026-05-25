/**
 * @module MainLayout
 * @description Layout principal con CSS Grid (header/sidebar/content/messages).
 * Réplica fiel del MainLayout.astro legacy, incluyendo:
 *   - Mobile: sidebar como drawer (fixed, transform translateX) controlado por
 *     data-mobile-open en #sidebar-panel + overlay #sidebar-overlay.
 *   - Desktop: grid 3 columnas (sidebar auto + content 1fr + opcional messages 16rem).
 *   - Carga de Google Material Symbols font para los iconos del Sidebar/Header.
 */
import { type ReactNode } from "react";

import Sidebar from "./Sidebar";
import PageHeader from "./PageHeader";
import type { UserRole } from "~/shared/types/roles";

type Props = {
  userName: string;
  role: UserRole;
  buttonLabel: string;
  userId?: number | string | null;
  showMessages?: boolean;
  children: ReactNode;
};

export default function MainLayout({
  userName,
  role,
  buttonLabel,
  userId,
  showMessages = false,
  children,
}: Props) {
  return (
    <>
      <div id="app" className={showMessages ? "list-messages" : ""}>
        <header id="page-header">
          <PageHeader userName={userName} buttonLabel={buttonLabel} userId={userId ?? null} />
        </header>

        <aside id="sidebar">
          <Sidebar role={role} />
        </aside>

        <section id="content">
          <div className="w-full min-w-0 max-w-none p-4 md:p-8 lg:p-10">{children}</div>
        </section>
      </div>

      <div id="sidebar-overlay" />

      <style>{`
        #app {
          display: grid;
          grid-template-areas:
            "header header header"
            "sidebar content messages";
          grid-template-columns: auto 1fr 0;
          grid-template-rows: auto 1fr;
          height: 100vh;
        }
        #app.list-messages {
          grid-template-columns: auto 1fr 16rem;
        }
        #page-header { grid-area: header; }
        #sidebar { grid-area: sidebar; }
        #content {
          grid-area: content;
          height: 100%;
          min-width: 0;
          overflow-y: auto;
          overflow-x: hidden;
          background: var(--color-surface);
        }

        @media (max-width: 767px) {
          #app, #app.list-messages {
            grid-template-areas: "header" "content";
            grid-template-columns: 1fr;
          }
          #content { min-height: 0; }

          #sidebar {
            position: fixed;
            left: 0; top: 0; bottom: 0;
            z-index: 40;
            transform: translateX(-100%);
            transition: transform 0.3s ease;
          }
          #sidebar [data-mobile-open="true"],
          #sidebar:has([data-mobile-open="true"]) {
            transform: translateX(0);
          }

          #sidebar-overlay {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.5);
            z-index: 39;
          }
          #sidebar-overlay.open {
            display: block;
          }
        }
      `}</style>

      {/* Material Symbols (outlined) — usado por MaterialIcon en Sidebar/PageHeader.
          Cargado aquí para que cualquier route bajo MainLayout tenga los iconos. */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0,0"
      />
    </>
  );
}
