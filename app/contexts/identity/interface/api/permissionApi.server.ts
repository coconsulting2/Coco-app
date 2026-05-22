/**
 * @module permissionApi.server
 * @description Dispatcher /api/admin/*. Réplica del controller legacy.
 * Cada loader/action de RR v7 in-app debería preferir DI directo a los
 * use-cases del slice; este resource route se conserva para compatibilidad
 * con componentes legacy y contrato OpenAPI.
 */
import { jsonOk, jsonError, jsonFromError } from "~/platform/http/responses";
import { requireSession, requirePermissions, runInTenant } from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as permissionService from "~/platform/permissions/permission-service.server.js";

type DispatchArgs = { request: Request; subpath: string };

const ROUTES: Array<{ method: string; pattern: RegExp; perm: string | null; handler: (m: RegExpMatchArray, ctx: any) => Promise<unknown> | unknown }> = [
  { method: "GET", pattern: /^permissions$/, perm: "permission:read", handler: async (m, { session, body, url }) => permissionService.getPermissions() },
  { method: "POST", pattern: /^permissions$/, perm: "permission:manage", handler: async (m, { session, body, url }) => permissionService.createPermission(body) },
  { method: "PUT", pattern: /^permissions\/(\d+)$/, perm: "permission:manage", handler: async (m, { session, body, url }) => permissionService.updatePermission(Number(m[1]), body) },
  { method: "DELETE", pattern: /^permissions\/(\d+)$/, perm: "permission:manage", handler: async (m, { session, body, url }) => permissionService.deactivatePermission(Number(m[1])) },
  { method: "GET", pattern: /^permission-groups$/, perm: "permission:read", handler: async (m, { session, body, url }) => permissionService.getPermissionGroups() },
  { method: "POST", pattern: /^permission-groups$/, perm: "permission:manage", handler: async (m, { session, body, url }) => permissionService.createPermissionGroup(body) },
  { method: "GET", pattern: /^permission-groups\/(\d+)$/, perm: "permission:read", handler: async (m, { session, body, url }) => permissionService.getPermissionGroup(Number(m[1])) },
  { method: "PUT", pattern: /^permission-groups\/(\d+)$/, perm: "permission:manage", handler: async (m, { session, body, url }) => permissionService.updatePermissionGroup(Number(m[1]), body) },
  { method: "DELETE", pattern: /^permission-groups\/(\d+)$/, perm: "permission:manage", handler: async (m, { session, body, url }) => permissionService.deactivatePermissionGroup(Number(m[1])) },
  { method: "POST", pattern: /^permission-groups\/(\d+)\/permissions$/, perm: "permission:manage", handler: async (m, { session, body, url }) => permissionService.addPermissionsToGroup(Number(m[1]), body?.permissionIds ?? []) },
  { method: "DELETE", pattern: /^permission-groups\/(\d+)\/permissions\/(\d+)$/, perm: "permission:manage", handler: async (m, { session, body, url }) => permissionService.removePermissionFromGroup(Number(m[1]), Number(m[2])) },
  { method: "GET", pattern: /^roles$/, perm: "role:manage_permissions", handler: async (m, { session, body, url }) => permissionService.listTenantRolesForAdmin() },
  { method: "POST", pattern: /^roles$/, perm: "role:manage_permissions", handler: async (m, { session, body, url }) => permissionService.createTenantRole(body) },
  { method: "PUT", pattern: /^roles\/(\d+)$/, perm: "role:manage_permissions", handler: async (m, { session, body, url }) => permissionService.updateTenantRole(Number(m[1]), body) },
  { method: "DELETE", pattern: /^roles\/(\d+)$/, perm: "role:manage_permissions", handler: async (m, { session, body, url }) => permissionService.deleteTenantRole(Number(m[1])) },
  { method: "POST", pattern: /^roles\/(\d+)\/permissions$/, perm: "role:manage_permissions", handler: async (m, { session, body, url }) => permissionService.addPermissionsToRole(Number(m[1]), body?.permissionIds ?? []) },
  { method: "DELETE", pattern: /^roles\/(\d+)\/permissions\/(\d+)$/, perm: "role:manage_permissions", handler: async (m, { session, body, url }) => permissionService.removePermissionFromRole(Number(m[1]), Number(m[2])) },
  { method: "POST", pattern: /^roles\/(\d+)\/permission-groups$/, perm: "role:manage_permissions", handler: async (m, { session, body, url }) => permissionService.addGroupsToRole(Number(m[1]), body?.groupIds ?? []) },
  { method: "DELETE", pattern: /^roles\/(\d+)\/permission-groups\/(\d+)$/, perm: "role:manage_permissions", handler: async (m, { session, body, url }) => permissionService.removeGroupFromRole(Number(m[1]), Number(m[2])) },
  { method: "POST", pattern: /^users\/(\d+)\/permissions$/, perm: "permission:manage", handler: async (m, { session, body, url }) => permissionService.addPermissionsToUser(Number(m[1]), body?.permissionIds ?? []) },
  { method: "DELETE", pattern: /^users\/(\d+)\/permissions\/(\d+)$/, perm: "permission:manage", handler: async (m, { session, body, url }) => permissionService.removePermissionFromUser(Number(m[1]), Number(m[2])) },
  { method: "POST", pattern: /^users\/(\d+)\/permission-groups$/, perm: "permission:manage", handler: async (m, { session, body, url }) => permissionService.addGroupsToUser(Number(m[1]), body?.groupIds ?? []) },
  { method: "DELETE", pattern: /^users\/(\d+)\/permission-groups\/(\d+)$/, perm: "permission:manage", handler: async (m, { session, body, url }) => permissionService.removeGroupFromUser(Number(m[1]), Number(m[2])) },
];

export async function dispatchPermissionApi({ request, subpath }: DispatchArgs): Promise<Response> {
  const method = request.method.toUpperCase();
  const path = subpath.split("?")[0] ?? "";
  const url = new URL(request.url);

  try {
    for (const r of ROUTES) {
      if (r.method !== method) continue;
      const m = path.match(r.pattern);
      if (!m) continue;
      const session = r.perm
        ? await requirePermissions(request, r.perm)
        : await requireSession(request);
      if (method !== "GET" && method !== "HEAD") {
        await assertCsrf(request);
      }
      const body = (method !== "GET" && method !== "HEAD") ? await readJson(request) : null;
      const result = await runInTenant(session, async () => r.handler(m, { session, body, url }));
      return jsonOk(result ?? { ok: true });
    }
    return jsonError(404, `Unknown permission endpoint: ${method} ${path}`, "UNKNOWN_ENDPOINT");
  } catch (err) {
    return jsonFromError(err);
  }
}

async function readJson(request: Request): Promise<any | null> {
  try {
    const text = await request.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}
