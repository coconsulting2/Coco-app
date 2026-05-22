/**
 * @module dashboard
 * @description Dashboard role-aware. Loader resuelve por DI las solicitudes
 * relevantes a cada rol y renderiza la vista correspondiente (ApplicantView,
 * AuthorizerView, AccountsPayableView, TravelAgencyView, AdminView) —
 * réplica fiel del switch role-views.ts del legacy.
 */
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRouteLoaderData } from "react-router";

import { requireSession, runInTenant } from "~/platform/session/requireUser.server";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — JS module
import * as userService from "~/contexts/identity/application/userService.js";
// @ts-ignore
import Applicant from "~/contexts/travel-requests/infrastructure/applicantModel.js";
// @ts-ignore
import UserModel from "~/contexts/identity/infrastructure/userModel.js";

import ApplicantView from "~/contexts/travel-requests/interface/views/ApplicantView";
import AuthorizerView from "~/contexts/approvals/interface/views/AuthorizerView";
import AccountsPayableView from "~/contexts/accounts-payable/interface/views/AccountsPayableView";
import TravelAgencyView from "~/contexts/travel-agency/interface/views/TravelAgencyView";
import AdminView from "~/contexts/identity/interface/views/AdminView";

import type { AppLayoutData } from "./_layout";

export function meta() {
  return [{ title: "Dashboard — CocoConsulting" }];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requireSession(request);
  const role = session.user.role;

  // Datos del perfil para el saludo personalizado.
  const profile = await runInTenant(session, async () => userService.getUserById(session.user.user_id));
  const userName = profile?.user_name ?? session.user.username ?? "Usuario";

  // Datos por rol — cada rol pide solo lo que su vista necesita.
  if (role === "Solicitante" || role === "N1" || role === "N2") {
    // Solicitudes activas (no Borrador) del solicitante. N1/N2 lo usan al ser
    // también solicitantes implícitos en el dashboard de Solicitante;
    // sin embargo, su vista REAL es AuthorizerView.
    if (role === "N1" || role === "N2") {
      const statusId = role === "N1" ? 2 : 3;
      const requests = await runInTenant(session, async () =>
        UserModel.getTravelRequestsForApprover(session.user.user_id, statusId, {
          organizationId: session.user.organization_id,
          n: null,
        }),
      );
      return {
        kind: "authorizer" as const,
        userName,
        role: role as "N1" | "N2",
        requests: (requests ?? []).map((r: any) => ({
          request_id: r.request_id,
          requester_name: r.requester_name ?? r.user_name ?? null,
          department_name: r.department_name ?? null,
          destination_country: r.destination_country,
          beginning_date: r.beginning_date,
          ending_date: r.ending_date,
        })),
      };
    }
    // Solicitante: lista activa.
    const all = await runInTenant(session, async () => Applicant.getApplicantRequests(session.user.user_id));
    const activeRequests = (all ?? []).filter((r: any) => r.status !== "Borrador");
    return {
      kind: "applicant" as const,
      userName,
      requests: activeRequests,
    };
  }

  if (role === "Cuentas por pagar") {
    const deptId = session.user.department_id ?? null;
    const [cotizar, comprobar] = await Promise.all([
      runInTenant(session, async () =>
        deptId ? UserModel.getTravelRequestsByDeptStatus(Number(deptId), 4, null) : [],
      ),
      runInTenant(session, async () =>
        deptId ? UserModel.getTravelRequestsByDeptStatus(Number(deptId), 7, null) : [],
      ),
    ]);
    return {
      kind: "cxp" as const,
      userName,
      requestsInCotizar: (cotizar ?? []).map((r: any) => ({
        request_id: r.request_id,
        destination_country: r.destination_country,
        beginning_date: r.beginning_date,
        ending_date: r.ending_date,
      })),
      requestsInComprobar: (comprobar ?? []).map((r: any) => ({
        request_id: r.request_id,
        destination_country: r.destination_country,
        beginning_date: r.beginning_date,
        ending_date: r.ending_date,
      })),
    };
  }

  if (role === "Agencia de viajes") {
    // Status 5 = "Atención Agencia de Viajes"
    const requests = await runInTenant(session, async () =>
      UserModel.getTravelRequestsByDeptStatus(0, 5, null).catch(() => []),
    );
    return {
      kind: "agency" as const,
      userName,
      requests: (requests ?? []).map((r: any) => ({
        request_id: r.request_id,
        destination_country: r.destination_country,
        beginning_date: r.beginning_date,
        ending_date: r.ending_date,
      })),
    };
  }

  if (role === "Administrador" || role === "Admin Ditta") {
    return {
      kind: "admin" as const,
      userName,
      isRoot: role === "Admin Ditta",
    };
  }

  // Fallback — rol desconocido o sin vista dedicada.
  return { kind: "unknown" as const, userName, role };
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

export default function DashboardRoute() {
  const data = useLoaderData() as LoaderData;
  const layout = useRouteLoaderData("routes/_app/_layout") as AppLayoutData;

  if (data.kind === "applicant") {
    return <ApplicantView userName={data.userName} requests={data.requests} />;
  }
  if (data.kind === "authorizer") {
    return <AuthorizerView userName={data.userName} role={data.role} requests={data.requests} />;
  }
  if (data.kind === "cxp") {
    return (
      <AccountsPayableView
        userName={data.userName}
        requestsInCotizar={data.requestsInCotizar}
        requestsInComprobar={data.requestsInComprobar}
      />
    );
  }
  if (data.kind === "agency") {
    return <TravelAgencyView userName={data.userName} requests={data.requests} />;
  }
  if (data.kind === "admin") {
    return <AdminView userName={data.userName} isRoot={data.isRoot} />;
  }

  // Fallback editorial.
  return (
    <main>
      <header className="mb-6">
        <p className="eyebrow mb-2">Coco / Inicio</p>
        <h1 className="font-editorial text-2xl font-normal leading-tight text-[var(--color-ink)] sm:text-3xl">
          Hola, {data.userName}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Rol: <strong>{layout.user.role}</strong>
        </p>
      </header>
    </main>
  );
}
