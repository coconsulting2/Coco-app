/**
 * OrganizationsAdmin — vista de gestión de organizaciones para super-admin Ditta.
 *
 * Prop-driven (RR7): la lista llega por prop `organizations` desde el loader.
 * Filtros vía `<Form method="get">` (loader-driven). Mutaciones (crear /
 * suspender / activar) vía `useFetcher` contra el `action` de la ruta. Toda la
 * data interna pasa por loader/action RR7. El impersonate sigue siendo estado
 * de cliente (localStorage + X-Organization-Id), no una llamada HTTP interna.
 */
import { useEffect, useState } from "react";
import { Form, useFetcher } from "react-router";
import {
  getImpersonatedOrgId,
  setImpersonatedOrgId,
} from "~/shared/stores/organizationStore";
import type { Organization } from "~/shared/types/organization";
import type { OrganizationsActionData } from "~/routes/_app/admin/organizations";

interface Props {
  organizations: Organization[];
  kind: string;
  status: string;
  csrfToken: string;
}

export default function OrganizationsAdmin({
  organizations,
  kind,
  status,
  csrfToken,
}: Props) {
  const [showWizard, setShowWizard] = useState(false);
  const [impersonatedId, setImpersonatedId] = useState<string | null>(
    getImpersonatedOrgId(),
  );

  const mutationFetcher = useFetcher<OrganizationsActionData>();
  const mutating = mutationFetcher.state !== "idle";
  const mutationError =
    mutationFetcher.data && mutationFetcher.data.ok === false
      ? mutationFetcher.data.error
      : null;

  const handleImpersonate = (orgId: string) => {
    if (impersonatedId === orgId) {
      setImpersonatedOrgId(null);
      setImpersonatedId(null);
    } else {
      setImpersonatedOrgId(orgId);
      setImpersonatedId(orgId);
    }
  };

  const submitOrgMutation = (
    intent: "suspend" | "activate",
    orgId: string,
  ) => {
    mutationFetcher.submit(
      { intent, organizationId: orgId, _csrf: csrfToken },
      { method: "post" },
    );
  };

  const handleSuspend = (orgId: string) => {
    if (!confirm("¿Suspender esta organización? Sus usuarios no podrán entrar.")) return;
    submitOrgMutation("suspend", orgId);
  };

  const handleActivate = (orgId: string) => {
    submitOrgMutation("activate", orgId);
  };

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Form method="get" className="flex gap-3 items-end">
          <label className="text-sm">
            <span className="block text-gray-600">Tipo</span>
            <select
              name="kind"
              className="border rounded px-2 py-1"
              defaultValue={kind}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
            >
              <option value="">Todos</option>
              <option value="ROOT">ROOT (Ditta)</option>
              <option value="CLIENT">Cliente</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-gray-600">Estado</span>
            <select
              name="status"
              className="border rounded px-2 py-1"
              defaultValue={status}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
            >
              <option value="">Todos</option>
              <option value="CONFIGURING">En configuración</option>
              <option value="ACTIVE">Activa</option>
              <option value="SUSPENDED">Suspendida</option>
            </select>
          </label>
          <noscript>
            <button type="submit" className="border rounded px-3 py-1 text-sm">
              Filtrar
            </button>
          </noscript>
        </Form>
        <button
          onClick={() => setShowWizard(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Nueva organización
        </button>
      </header>

      {impersonatedId && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm flex items-center justify-between">
          <span>
            Estás viendo datos como org <strong>{impersonatedId}</strong>. Las queries usarán X-Organization-Id.
          </span>
          <button
            onClick={() => {
              setImpersonatedOrgId(null);
              setImpersonatedId(null);
            }}
            className="text-yellow-900 underline"
          >
            Salir de impersonate
          </button>
        </div>
      )}

      {mutationError && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded p-3">
          {mutationError}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full border">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2 text-left">ID</th>
              <th className="px-3 py-2 text-left">Nombre</th>
              <th className="px-3 py-2 text-left">RFC</th>
              <th className="px-3 py-2 text-left">Tipo</th>
              <th className="px-3 py-2 text-left">Estado</th>
              <th className="px-3 py-2 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {organizations.map((o) => (
              <tr key={o.id} className="border-t">
                <td className="px-3 py-2 font-mono text-xs">{o.id}</td>
                <td className="px-3 py-2">{o.nombre}</td>
                <td className="px-3 py-2">{o.rfc ?? "—"}</td>
                <td className="px-3 py-2">
                  <span className={o.kind === "ROOT" ? "text-purple-700 font-semibold" : ""}>{o.kind}</span>
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={o.status} />
                </td>
                <td className="px-3 py-2 space-x-2 text-sm">
                  {o.kind !== "ROOT" && (
                    <button
                      onClick={() => handleImpersonate(o.id)}
                      className="text-blue-600 hover:underline"
                    >
                      {impersonatedId === o.id ? "Salir" : "Ver como"}
                    </button>
                  )}
                  {o.status !== "ACTIVE" && o.kind !== "ROOT" && (
                    <button
                      onClick={() => handleActivate(o.id)}
                      disabled={mutating}
                      className="text-green-600 hover:underline disabled:opacity-50"
                    >
                      Activar
                    </button>
                  )}
                  {o.status === "ACTIVE" && o.kind !== "ROOT" && (
                    <button
                      onClick={() => handleSuspend(o.id)}
                      disabled={mutating}
                      className="text-red-600 hover:underline disabled:opacity-50"
                    >
                      Suspender
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {organizations.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-gray-500 py-6">
                  Sin organizaciones para los filtros actuales.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showWizard && (
        <CreateOrganizationWizard
          csrfToken={csrfToken}
          onClose={() => setShowWizard(false)}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Organization["status"] }) {
  const map: Record<Organization["status"], string> = {
    CONFIGURING: "bg-gray-100 text-gray-800",
    ACTIVE: "bg-green-100 text-green-800",
    SUSPENDED: "bg-red-100 text-red-800",
  };
  const label = { CONFIGURING: "En configuración", ACTIVE: "Activa", SUSPENDED: "Suspendida" }[status];
  return <span className={`inline-block rounded px-2 py-0.5 text-xs ${map[status]}`}>{label}</span>;
}

function CreateOrganizationWizard({
  csrfToken,
  onClose,
}: {
  csrfToken: string;
  onClose: () => void;
}) {
  const fetcher = useFetcher<OrganizationsActionData>();
  const submitting = fetcher.state !== "idle";
  const error =
    fetcher.data && fetcher.data.ok === false ? fetcher.data.error : null;

  // Cierra el wizard cuando el create termina OK.
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok === true && fetcher.data.intent === "create") {
      onClose();
    }
  }, [fetcher.state, fetcher.data, onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <fetcher.Form
        method="post"
        className="bg-white rounded-lg p-6 w-full max-w-2xl space-y-4"
      >
        <input type="hidden" name="_csrf" value={csrfToken} />
        <input type="hidden" name="intent" value="create" />

        <h2 className="text-xl font-semibold">Nueva organización</h2>

        {error && <div className="bg-red-50 border border-red-200 text-red-800 rounded p-3">{error}</div>}

        <fieldset className="space-y-2">
          <legend className="font-medium">Datos fiscales</legend>
          <input
            name="nombre"
            required
            className="w-full border rounded px-2 py-1"
            placeholder="Nombre comercial *"
          />
          <input
            name="razonSocial"
            className="w-full border rounded px-2 py-1"
            placeholder="Razón social"
          />
          <input
            name="rfc"
            className="w-full border rounded px-2 py-1"
            placeholder="RFC (opcional)"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              name="timezone"
              className="border rounded px-2 py-1"
              placeholder="Zona horaria"
              defaultValue="America/Mexico_City"
            />
            <input
              name="baseCurrency"
              className="border rounded px-2 py-1"
              placeholder="Moneda base"
              defaultValue="MXN"
            />
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="font-medium">Administrador inicial</legend>
          <input
            name="adminNombre"
            className="w-full border rounded px-2 py-1"
            placeholder="Nombre completo *"
          />
          <input
            name="adminEmail"
            type="email"
            required
            className="w-full border rounded px-2 py-1"
            placeholder="Email *"
          />
          <input
            name="adminPassword"
            type="password"
            required
            className="w-full border rounded px-2 py-1"
            placeholder="Contraseña inicial *"
          />
          <p className="text-xs text-gray-500">
            El admin podrá cambiar su contraseña al primer ingreso.
          </p>
        </fieldset>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded border"
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300"
          >
            {submitting ? "Creando…" : "Crear organización"}
          </button>
        </div>
      </fetcher.Form>
    </div>
  );
}
