/**
 * @module reembolso
 * @description Página de reembolsos del usuario. Loader DI a
 * `getRefundDashboardForUser(userId)` del slice `refunds` (HEX_PROPER) — pasa
 * el resultado al componente prop-driven `RefundDashboard`. Sin @ts-ignore.
 */
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import { requirePermissions, runInTenant } from "~/platform/session/requireUser.server";
import { getRefundDashboardForUser } from "~/contexts/refunds";

import RefundDashboard from "~/shared/ui/RefundDashboard";

export function meta() {
  return [{ title: "Reembolsos — CocoConsulting" }];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requirePermissions(request, "travel_request:view_own");
  const data = await runInTenant(session, async () =>
    getRefundDashboardForUser(session.user.user_id),
  );
  return { data };
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

export default function ReembolsoRoute() {
  const { data } = useLoaderData() as LoaderData;
  return <RefundDashboard data={data} />;
}
