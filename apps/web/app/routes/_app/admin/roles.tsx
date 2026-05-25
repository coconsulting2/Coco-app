/**
 * @module admin/roles
 * @description Admin de roles y permisos. Loader precarga el catálogo
 * inicial (tenant roles + RBAC permissions) vía use-case hex
 * `listAdminRolesCatalog` del slice identity. La `action` expone los intents
 * create/update/delete que invocan los use-cases hex `createTenantRole` /
 * `updateTenantRole` / `deleteTenantRole` (DI → port → adapter legacy), todos
 * dentro de `runInTenant` + `assertCsrf` + `requirePermissions`. `RolesAdmin`
 * es prop-driven: recibe `initialData` + `permissionRows` del loader y muta vía
 * `useFetcher` contra esta misma ruta — cero `apiRequest`/fetch a `/api/*`.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import {
  requirePermissions,
  runInTenant,
} from "~/platform/session/requireUser.server";
import { assertCsrf, issueCsrfToken } from "~/platform/csrf/csrf.server";
import {
  listAdminRolesCatalog,
  createTenantRole,
  updateTenantRole,
  deleteTenantRole,
  type TenantRoleAdminRow,
  type CreateTenantRoleInput,
  type UpdateTenantRoleInput,
} from "~/contexts/identity/index.js";
import RolesAdmin from "~/shared/ui/RolesAdmin";
import type { Role } from "~/shared/types/Role";

export function meta() {
  return [{ title: "Roles — CocoConsulting" }];
}

type ApiPermissionRow = {
  code: string;
  resource: string;
  description: string | null;
};

function toRole(row: TenantRoleAdminRow): Role {
  return {
    role_id: row.role_id,
    name: row.name,
    permissions: row.permissions,
    max_authorization_amount: row.max_authorization_amount,
    expiration_date: row.expiration_date,
    is_admin: row.is_admin,
    active_users_count: row.active_users_count,
    is_system: row.is_system,
  };
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requirePermissions(request, "role:manage_permissions");
  const catalog = await runInTenant(session, listAdminRolesCatalog);
  const csrf = issueCsrfToken(request);

  const roles: Role[] = catalog.roles.map((r) => ({
    role_id: r.id,
    name: r.name,
    permissions: r.permissions.map((p) => p.code),
    max_authorization_amount: null,
    expiration_date: null,
    is_admin: r.permissions.some((p) => p.code === "role:manage_permissions"),
    active_users_count: 0,
  }));

  const permissionRows: ApiPermissionRow[] = catalog.permissions.map((p) => ({
    code: p.code,
    resource: p.resource,
    description: p.description,
  }));

  return new Response(JSON.stringify({ roles, permissionRows, csrfToken: csrf.token }), {
    status: 200,
    headers: { "content-type": "application/json", "set-cookie": csrf.setCookie },
  });
}

type LoaderData = {
  roles: Role[];
  permissionRows: ApiPermissionRow[];
  csrfToken: string;
};

export type RolesActionResult =
  | { ok: true; intent: "create" | "update"; role: Role }
  | { ok: true; intent: "delete"; roleId: number }
  | { ok: false; error: string };

function parseAmount(form: FormData): number | null {
  const raw = form.get("max_authorization_amount");
  if (raw == null) return null;
  const s = raw.toString().trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parsePermissions(form: FormData): string[] {
  const raw = form.get("permissions")?.toString() ?? "[]";
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((c) => String(c));
  } catch {
    /* fall through */
  }
  return [];
}

export async function action({ request }: ActionFunctionArgs): Promise<Response> {
  const session = await requirePermissions(request, "role:manage_permissions");
  await assertCsrf(request);

  const form = await request.formData();
  const intent = form.get("_intent")?.toString() ?? "";

  try {
    if (intent === "create") {
      const input: CreateTenantRoleInput = {
        name: form.get("name")?.toString() ?? "",
        permissions: parsePermissions(form),
        max_authorization_amount: parseAmount(form),
        expiration_date: form.get("expiration_date")?.toString() || null,
        is_admin: form.get("is_admin")?.toString() === "true",
      };
      const row = await runInTenant(session, async () => createTenantRole(input));
      return Response.json(
        { ok: true, intent: "create", role: toRole(row) } satisfies RolesActionResult,
        { status: 201 },
      );
    }

    if (intent === "update") {
      const roleId = Number(form.get("role_id"));
      if (!Number.isFinite(roleId)) {
        return Response.json(
          { ok: false, error: "role_id inválido" } satisfies RolesActionResult,
          { status: 400 },
        );
      }
      const input: UpdateTenantRoleInput = {
        max_authorization_amount: parseAmount(form),
      };
      // Solo enviamos nombre/permisos/admin si vienen explícitos (roles de
      // sistema solo aceptan monto; el servicio legacy valida el resto).
      if (form.get("name") != null) input.name = form.get("name")?.toString();
      if (form.get("permissions") != null) input.permissions = parsePermissions(form);
      if (form.get("is_admin") != null) {
        input.is_admin = form.get("is_admin")?.toString() === "true";
      }
      if (form.get("expiration_date") != null) {
        input.expiration_date = form.get("expiration_date")?.toString() || null;
      }
      const row = await runInTenant(session, async () => updateTenantRole(roleId, input));
      return Response.json(
        { ok: true, intent: "update", role: toRole(row) } satisfies RolesActionResult,
        { status: 200 },
      );
    }

    if (intent === "delete") {
      const roleId = Number(form.get("role_id"));
      if (!Number.isFinite(roleId)) {
        return Response.json(
          { ok: false, error: "role_id inválido" } satisfies RolesActionResult,
          { status: 400 },
        );
      }
      await runInTenant(session, async () => deleteTenantRole(roleId));
      return Response.json(
        { ok: true, intent: "delete", roleId } satisfies RolesActionResult,
        { status: 200 },
      );
    }

    return Response.json(
      { ok: false, error: "Intent no soportado" } satisfies RolesActionResult,
      { status: 400 },
    );
  } catch (err) {
    const e = err as { message?: string; status?: number };
    return Response.json(
      { ok: false, error: e?.message ?? "Error al procesar el rol" } satisfies RolesActionResult,
      { status: e?.status ?? 500 },
    );
  }
}

export default function PageRoute() {
  const { roles, permissionRows, csrfToken } = useLoaderData() as LoaderData;

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">Coco / Admin / Roles</p>
        <h1 className="font-serif text-3xl md:text-4xl">Roles y permisos</h1>
        <p className="text-sm text-[var(--color-ink-muted)]">
          {roles.length} rol(es) en el tenant.
        </p>
      </header>
      <RolesAdmin initialData={roles} permissionRows={permissionRows} csrfToken={csrfToken} />
    </section>
  );
}
