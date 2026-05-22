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
import { getUserProfile } from "~/contexts/identity";
import { getApprovalInbox } from "~/contexts/approvals";
import { listTravelRequestsByDeptStatus } from "~/contexts/travel-requests";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — JS module (travel-requests slice pending hexagonal refactor — ver CLEANUP_PLAN.md)
import Applicant from "~/contexts/travel-requests/infrastructure/applicantModel.js";

import ApplicantView from "~/contexts/travel-requests/interface/views/ApplicantView";
import AuthorizerView from "~/contexts/approvals/interface/views/AuthorizerView";
import AccountsPayableView from "~/contexts/accounts-payable/interface/views/AccountsPayableView";
import TravelAgencyView from "~/contexts/travel-agency/interface/views/TravelAgencyView";
import AdminView from "~/contexts/identity/interface/views/AdminView";

import type { AppLayoutData } from "~/routes/_app/_layout";

export function meta() {
  return [{ title: "Dashboard — CocoConsulting" }];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requireSession(request);
  const role = session.user.role;

  const profile = await runInTenant(session, async () => getUserProfile(session.user.user_id));
  const userName = profile?.username ?? session.user.username ?? "Usuario";

  if (role === "Solicitante" || role === "N1" || role === "N2") {
    if (role === "N1" || role === "N2") {
      const narrowRole: "N1" | "N2" = role;
      const statusId: 2 | 3 = narrowRole === "N1" ? 2 : 3;
      const requests = await runInTenant(session, async () =>
        getApprovalInbox(session.user.user_id, statusId, {
          organizationId: session.user.organization_id,
          n: null,
        }),
      );
      return {
        kind: "authorizer" as const,
        userName,
        role: narrowRole,
        requests: requests.map((r) => ({
          request_id: r.requestId,
          requester_name: r.requesterName ?? null,
          department_name: r.departmentName ?? null,
          destination_country: r.destinationCountry,
          beginning_date: r.beginningDate,
          ending_date: r.endingDate,
        })),
      };
    }
    // Solicitante: lista activa vía legacy applicantModel (travel-requests slice
    // pending hexagonal refactor — ver CLEANUP_PLAN.md).
    type LegacyApplicantRequest = {
      request_id: number;
      status: string;
      destination_country: string | null;
      beginning_date?: string | Date | null;
      ending_date?: string | Date | null;
    };
    const all = (await runInTenant(session, async () =>
      Applicant.getApplicantRequests(session.user.user_id),
    )) as LegacyApplicantRequest[] | null;
    const activeRequests = (all ?? []).filter((r) => r.status !== "Borrador");
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
        deptId ? listTravelRequestsByDeptStatus(Number(deptId), 4, null) : [],
      ),
      runInTenant(session, async () =>
        deptId ? listTravelRequestsByDeptStatus(Number(deptId), 7, null) : [],
      ),
    ]);
    return {
      kind: "cxp" as const,
      userName,
      requestsInCotizar: cotizar.map((r) => ({
        request_id: r.requestId,
        destination_country: r.destinationCountry,
        beginning_date: r.beginningDate,
        ending_date: r.endingDate,
      })),
      requestsInComprobar: comprobar.map((r) => ({
        request_id: r.requestId,
        destination_country: r.destinationCountry,
        beginning_date: r.beginningDate,
        ending_date: r.endingDate,
      })),
    };
  }

  if (role === "Agencia de viajes") {
    // Status 5 = "Atención Agencia de Viajes". El departmentId 0 es legacy
    // (la query original ignora el dept para agency; pasa 0).
    const requests = await runInTenant(session, async () =>
      listTravelRequestsByDeptStatus(0, 5, null).catch(() => []),
    );
    return {
      kind: "agency" as const,
      userName,
      requests: requests.map((r) => ({
        request_id: r.requestId,
        destination_country: r.destinationCountry,
        beginning_date: r.beginningDate,
        ending_date: r.endingDate,
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
