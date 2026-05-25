/**
 * @module admin/organizations
 * @description Admin cross-tenant de organizaciones (super-admin Ditta). El
 * loader precarga la lista (filtrada por kind/status desde la URL) vía el
 * use-case hex `listOrganizations` y emite el CSRF token. El action despacha
 * los intents `create` / `suspend` / `activate` contra los use-cases del slice
 * (DI directo, sin HTTP interno). Como son operaciones cross-org, el loader
 * pide `organization:list_all` y cada intent valida su permiso específico
 * (paridad 1:1 con `TC3005B.501-Backend/routes/organizationRoutes.js`).
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { data, useLoaderData } from "react-router";

import {
  assertPermission,
  requirePermissions,
  runInRls,
} from "~/platform/session/requireUser.server";
import { assertCsrf, issueCsrfToken } from "~/platform/csrf/csrf.server";
import {
  activateOrganization,
  createOrganization,
  listOrganizations,
  suspendOrganization,
  OrganizationValidationError,
  type CreateOrganizationInput,
  type SerializedOrganization,
} from "~/contexts/organizations";
import OrganizationsAdmin from "~/shared/ui/admin/OrganizationsAdmin";
import type { Organization } from "~/shared/types/organization";

export function meta() {
  return [{ title: "Organizaciones — CocoConsulting" }];
}

function toUiOrganization(o: SerializedOrganization): Organization {
  return {
    id: o.id,
    nombre: o.nombre,
    razonSocial: o.razonSocial,
    rfc: o.rfc,
    logoUrl: o.logoUrl,
    timezone: o.timezone,
    baseCurrency: o.baseCurrency,
    kind: o.kind === "ROOT" ? "ROOT" : "CLIENT",
    status:
      o.status === "ACTIVE"
        ? "ACTIVE"
        : o.status === "SUSPENDED"
          ? "SUSPENDED"
          : "CONFIGURING",
    createdAt:
      o.createdAt instanceof Date ? o.createdAt.toISOString() : String(o.createdAt),
    updatedAt:
      o.updatedAt instanceof Date ? o.updatedAt.toISOString() : String(o.updatedAt),
  };
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requirePermissions(request, "organization:list_all");
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") ?? "";
  const status = url.searchParams.get("status") ?? "";

  const result = await runInRls(session, async () =>
    listOrganizations({
      kind: kind || undefined,
      status: status || undefined,
    }),
  );

  const csrf = issueCsrfToken(request);
  return data(
    {
      organizations: result.data.map(toUiOrganization),
      total: result.total,
      kind,
      status,
      csrfToken: csrf.token,
    },
    { headers: { "set-cookie": csrf.setCookie } },
  );
}

export type OrganizationsActionData =
  | { ok: true; intent: "create" | "suspend" | "activate" }
  | { ok: false; error: string };

export async function action({
  request,
}: ActionFunctionArgs): Promise<OrganizationsActionData> {
  const session = await requirePermissions(request, "organization:list_all");
  await assertCsrf(request);

  const form = await request.formData();
  const intent = form.get("intent")?.toString() ?? "";

  try {
    if (intent === "create") {
      assertPermission(session, "organization:create");
      const rfc = form.get("rfc")?.toString().trim();
      const input: CreateOrganizationInput = {
        nombre: form.get("nombre")?.toString() ?? "",
        razonSocial: form.get("razonSocial")?.toString() || null,
        rfc: rfc ? rfc : null,
        timezone: form.get("timezone")?.toString() || "America/Mexico_City",
        baseCurrency: form.get("baseCurrency")?.toString() || "MXN",
        adminEmail: form.get("adminEmail")?.toString() ?? "",
        adminNombre: form.get("adminNombre")?.toString() || undefined,
        adminPassword: form.get("adminPassword")?.toString() ?? "",
      };
      await runInRls(session, async () => createOrganization(input));
      return { ok: true, intent: "create" };
    }

    if (intent === "suspend") {
      assertPermission(session, "organization:suspend");
      const id = form.get("organizationId")?.toString() ?? "";
      await runInRls(session, async () => suspendOrganization(id));
      return { ok: true, intent: "suspend" };
    }

    if (intent === "activate") {
      assertPermission(session, "organization:activate");
      const id = form.get("organizationId")?.toString() ?? "";
      await runInRls(session, async () => activateOrganization(id));
      return { ok: true, intent: "activate" };
    }

    return { ok: false, error: `Intent desconocido: ${intent}` };
  } catch (err) {
    if (err instanceof OrganizationValidationError) {
      return { ok: false, error: err.message };
    }
    const e = err as { message?: string };
    return { ok: false, error: e?.message ?? "Error procesando la operación." };
  }
}

type LoaderData = {
  organizations: Organization[];
  total: number;
  kind: string;
  status: string;
  csrfToken: string;
};

export default function PageRoute() {
  const d = useLoaderData() as LoaderData;

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">
          Coco / Admin / Orgs
        </p>
        <h1 className="font-serif text-3xl md:text-4xl">Organizaciones</h1>
        <p className="text-sm text-[var(--color-ink-muted)]">
          {d.total} organización(es).
        </p>
      </header>
      <OrganizationsAdmin
        organizations={d.organizations}
        kind={d.kind}
        status={d.status}
        csrfToken={d.csrfToken}
      />
    </section>
  );
}
