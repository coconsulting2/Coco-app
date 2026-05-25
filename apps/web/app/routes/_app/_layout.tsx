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
import { data, Outlet, useLoaderData } from "react-router";

import MainLayout from "~/shared/layouts/MainLayout";
import { requireSession, runInTenant } from "~/platform/session/requireUser.server";
import { loadEffectivePermissions } from "~/platform/permissions/permission-service.server.js";
import { issueCsrfToken } from "~/platform/csrf/csrf.server";
import { listNotifications } from "~/contexts/notifications";
import { roleLabels } from "~/shared/config/role-labels";
import type { UserRole } from "~/shared/types/roles";

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requireSession(request);

  // DI: llamamos a los use-cases directamente (NO fetch a /api/*). La campanita
  // global recibe `notifications` por prop desde este loader (regla 4) y mutea
  // mark-read contra el action de la ruta `/notificaciones`.
  const [permissions, notifications] = await runInTenant(session, async () =>
    Promise.all([
      loadEffectivePermissions(session.user.user_id),
      listNotifications(session.user.user_id),
    ]),
  );

  // CSRF cookie disponible en TODA página autenticada, para que la campanita
  // pueda postear mark-read con `_csrf` desde cualquier ruta.
  const csrf = issueCsrfToken(request);

  return data(
    {
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
      notifications,
      csrfToken: csrf.token,
      impersonatedOrgId: session.organizationId.toString(),
    },
    { headers: { "set-cookie": csrf.setCookie } },
  );
}

export type AppLayoutData = Awaited<ReturnType<typeof loader>>["data"];

export default function AppLayout() {
  const ld = useLoaderData() as AppLayoutData;
  const userName = ld.user.username ?? `Usuario ${ld.user.userId}`;
  const buttonLabel = roleLabels[ld.user.role] ?? ld.user.role;
  return (
    <MainLayout
      userName={userName}
      role={ld.user.role}
      buttonLabel={buttonLabel}
      notifications={ld.notifications}
      csrfToken={ld.csrfToken}
    >
      <Outlet />
    </MainLayout>
  );
}
