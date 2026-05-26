/**
 * @module AdminView
 * @description Dashboard Admin (org y Ditta) — accesos rápidos a paneles.
 */
import { Link } from "react-router";

import EditorialHeader from "~/shared/ui/editorial/EditorialHeader";
import MaterialIcon from "~/shared/ui/MaterialIcon";

/**
 * Fila de usuario para la tabla admin (prop-driven; el loader del dashboard
 * la deriva de `listUsersForAdmin`). Paridad con la `User` del legacy
 * `AdminView.astro` (snake_case).
 */
export type AdminUserRow = {
  user_id: number;
  user_name: string;
  email: string;
  role_name: string;
  department_name: string | null;
  organization_name: string | null;
};

type Props = {
  userName: string;
  isRoot: boolean;
  users: AdminUserRow[];
};

const ROLE_VARIANT: Record<string, string> = {
  Administrador: "bg-primary-50 text-primary-500",
  N1: "bg-success-50 text-success-500",
  N2: "bg-success-50 text-success-500",
  Solicitante: "bg-[var(--color-surface-secondary)] text-[var(--color-ink-secondary)]",
  "Agencia de viajes": "bg-warning-50 text-warning-500",
  "Cuentas por pagar": "bg-accent-50 text-accent-400",
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function groupByOrganization(
  users: AdminUserRow[],
): Array<{ orgLabel: string; users: AdminUserRow[] }> {
  const m = new Map<string, AdminUserRow[]>();
  for (const u of users) {
    const key = (u.organization_name ?? "").trim() || "Sin organización";
    const list = m.get(key);
    if (list) list.push(u);
    else m.set(key, [u]);
  }
  return Array.from(m.entries())
    .sort((a, b) => a[0].localeCompare(b[0], "es", { sensitivity: "base" }))
    .map(([orgLabel, list]) => ({ orgLabel, users: list }));
}

const PANELS = [
  { to: "/crear-usuario",                 icon: "manage_accounts",  label: "Crear usuario",          desc: "Agregar nuevos miembros al equipo" },
  { to: "/admin/expense-policies",        icon: "rule",             label: "Políticas de viáticos",  desc: "Topes por categoría y destino" },
  { to: "/admin/employee-categories",     icon: "badge",             label: "Categorías de empleado", desc: "Tabuladores y rangos" },
  { to: "/admin/refund-time-limits",      icon: "schedule",          label: "Plazo de reembolso",     desc: "Tiempo límite para comprobar" },
  { to: "/admin/catalogo-contable",       icon: "account_balance",   label: "Catálogo contable",      desc: "Cuentas GL + sociedades" },
  { to: "/admin/indicadores-impuesto",    icon: "percent",           label: "Indicadores de impuesto",desc: "ISR, IVA, retención" },
  { to: "/admin/mapeo-gastos",            icon: "sync_alt",          label: "Mapeo de gastos",        desc: "Tipo de gasto → cuenta" },
  { to: "/admin/cost-centers",            icon: "business",          label: "Centros de costo",       desc: "CC + departamentos" },
  { to: "/admin/onboarding-import",       icon: "upload_file",       label: "Importar usuarios",      desc: "CSV / JSON masivo" },
  { to: "/admin/workflow-rules",          icon: "rule_settings",     label: "Reglas de workflow",     desc: "Aprobadores + escalation" },
  { to: "/admin/workflow-simulator",      icon: "play_circle",       label: "Simulador workflow",     desc: "Validar reglas antes de publicar" },
  { to: "/admin/roles",                   icon: "vpn_key",           label: "Roles y permisos",       desc: "RBAC granular" },
] as const;

const DITTA_ONLY = [
  { to: "/admin/organizations", icon: "domain", label: "Organizaciones", desc: "Multi-tenant management" },
];

export default function AdminView({ userName, isRoot, users }: Props) {
  const userGroups = groupByOrganization(users);
  const roleCount = new Set(users.map((u) => u.role_name)).size;

  return (
    <main>
      <EditorialHeader
        eyebrow={isRoot ? "Coco / Admin Ditta" : "Coco / Administración"}
        title={`Hola, ${userName}`}
        subtitle="Configuración y administración del tenant"
      />

      {isRoot && (
        <section className="mb-8">
          <p className="eyebrow mb-3">Super-admin Ditta</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {DITTA_ONLY.map((p) => (
              <PanelCard key={p.to} {...p} />
            ))}
          </div>
        </section>
      )}

      <section className="mb-8">
        <p className="eyebrow mb-3">Paneles de administración</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PANELS.map((p) => (
            <PanelCard key={p.to} {...p} />
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3 gap-3">
          <p className="eyebrow">Usuarios del sistema</p>
          <Link
            to="/crear-usuario"
            className="shrink-0 rounded-[var(--radius-md)] bg-primary-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-400 transition-colors"
          >
            + Crear usuario
          </Link>
        </div>

        {users.length === 0 ? (
          <div className="card-editorial p-6 text-center">
            <p className="text-sm text-[var(--color-ink-muted)]">
              No hay usuarios registrados.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-[var(--color-ink-muted)]">
              {users.length} {users.length === 1 ? "usuario" : "usuarios"} en{" "}
              {userGroups.length}{" "}
              {userGroups.length === 1 ? "organización" : "organizaciones"} ·{" "}
              {roleCount} {roleCount === 1 ? "rol" : "roles"} activos
            </p>

            <div className="card-editorial overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-[var(--color-neutral-200)]">
                      <th className="px-6 py-3 text-left eyebrow">ID</th>
                      <th className="px-6 py-3 text-left eyebrow">Usuario</th>
                      <th className="px-6 py-3 text-left eyebrow">Email</th>
                      <th className="px-6 py-3 text-left eyebrow">Rol</th>
                      <th className="px-6 py-3 text-left eyebrow">Departamento</th>
                      <th className="px-6 py-3 text-center eyebrow">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userGroups.map((group) => (
                      <UserGroupRows key={group.orgLabel} {...group} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function UserGroupRows({ orgLabel, users }: { orgLabel: string; users: AdminUserRow[] }) {
  return (
    <>
      <tr className="bg-[var(--color-surface-tertiary)] border-b border-[var(--color-neutral-200)]">
        <td
          colSpan={6}
          className="px-6 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-secondary)]"
        >
          {orgLabel}
          <span className="normal-case font-normal text-[var(--color-ink-muted)]">
            {" "}
            — {users.length === 1 ? "1 usuario" : `${users.length} usuarios`}
          </span>
        </td>
      </tr>
      {users.map((user, index) => {
        const isLastInGroup = index === users.length - 1;
        return (
          <tr
            key={user.user_id}
            className={`${
              !isLastInGroup ? "border-b border-[var(--color-neutral-200)]" : ""
            } hover:bg-[var(--color-surface-secondary)] transition-colors`}
          >
            <td className="px-6 py-4 text-sm text-[var(--color-ink-muted)] tabular-nums">
              {user.user_id}
            </td>
            <td className="px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--color-neutral-200)] text-[var(--color-ink-secondary)] flex-shrink-0">
                  <span className="text-xs font-semibold">{initials(user.user_name)}</span>
                </div>
                <span className="text-sm font-medium text-[var(--color-ink)]">
                  {user.user_name}
                </span>
              </div>
            </td>
            <td className="px-6 py-4 text-sm text-[var(--color-ink-secondary)]">{user.email}</td>
            <td className="px-6 py-4">
              <span
                className={`status-pill ${
                  ROLE_VARIANT[user.role_name] ||
                  "bg-[var(--color-surface-secondary)] text-[var(--color-ink-secondary)]"
                }`}
              >
                {user.role_name}
              </span>
            </td>
            <td className="px-6 py-4 text-sm text-[var(--color-ink-secondary)]">
              {user.department_name || "—"}
            </td>
            <td className="px-6 py-4 text-center">
              <Link
                to={`/editar-usuario/${user.user_id}`}
                className="text-sm text-primary-500 hover:text-primary-400 transition-colors font-medium"
              >
                Editar
              </Link>
            </td>
          </tr>
        );
      })}
    </>
  );
}

function PanelCard({ to, icon, label, desc }: { to: string; icon: string; label: string; desc: string }) {
  return (
    <Link
      to={to}
      className="card-editorial p-4 hover:bg-[var(--color-surface-secondary)] transition-colors block"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-md bg-[var(--color-primary-50,#f0f4e8)] text-[var(--color-primary-500)] flex items-center justify-center shrink-0">
          <MaterialIcon icon={icon} color="currentColor" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-[var(--color-ink)] truncate">{label}</p>
          <p className="text-xs text-[var(--color-ink-muted)] mt-0.5 truncate">{desc}</p>
        </div>
      </div>
    </Link>
  );
}
