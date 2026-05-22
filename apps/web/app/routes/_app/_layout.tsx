/**
 * @module _layout
 * @description Layout autenticado. TODA ruta hija pasa por este loader, que:
 *   1. Verifica sesión (JWT en cookie httpOnly).
 *   2. Resuelve tenant context + RLS.
 *   3. Carga permission set efectivo del usuario (vía import directo del
 *      service — NO fetch HTTP).
 *
 * El `useRouteLoaderData("routes/_app/_layout")` da acceso a `user` desde
 * cualquier componente bajo `/dashboard`, `/perfil-usuario`, etc.
 */
import type { LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData } from "react-router";

import MainLayout from "~/shared/layouts/MainLayout";
import { requireSession, runInTenant } from "~/platform/session/requireUser.server";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — JS module
import { loadEffectivePermissions } from "~/platform/permissions/permission-service.server.js";
import { roleLabels } from "@config/role-labels";
import type { UserRole } from "@type/roles";

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requireSession(request);

  // DI: llamamos al service directamente. NO fetch a /api/user/me/permissions.
  const permissions = await runInTenant(session, async () =>
    loadEffectivePermissions(session.user.user_id),
  );

  return {
    user: {
      userId: session.user.user_id,
      username: session.user.username ?? null,
      role: session.user.role as UserRole,
      organizationId: session.user.organization_id ?? null,
      organizationKind: session.user.organization_kind ?? null,
      departmentId: session.user.department_id ?? null,
      isRoot: session.isRoot,
    },
    permissions,
    impersonatedOrgId: session.organizationId.toString(),
  };
}

export type AppLayoutData = Awaited<ReturnType<typeof loader>>;

export default function AppLayout() {
  const data = useLoaderData() as AppLayoutData;
  const userName = data.user.username ?? `Usuario ${data.user.userId}`;
  const buttonLabel = roleLabels[data.user.role] ?? data.user.role;
  return (
    <MainLayout
      userName={userName}
      role={data.user.role}
      buttonLabel={buttonLabel}
      userId={data.user.userId}
    >
      <Outlet />
    </MainLayout>
  );
}
