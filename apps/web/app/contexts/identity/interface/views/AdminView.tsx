/**
 * @module AdminView
 * @description Dashboard Admin (org y Ditta) — accesos rápidos a paneles.
 */
import { Link } from "react-router";

import EditorialHeader from "~/shared/ui/editorial/EditorialHeader";
import MaterialIcon from "~/shared/ui/MaterialIcon";

type Props = {
  userName: string;
  isRoot: boolean;
};

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

export default function AdminView({ userName, isRoot }: Props) {
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

      <section>
        <p className="eyebrow mb-3">Paneles de administración</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PANELS.map((p) => (
            <PanelCard key={p.to} {...p} />
          ))}
        </div>
      </section>
    </main>
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
