/**
 * @module reembolso
 * @description Página de reembolsos del usuario. Loader DI a
 * `refundDashboardService.getRefundDashboardForUser(userId)` — pasa el resultado
 * al componente legacy `RefundDashboard` via `initialData` (skip su fetch interno).
 */
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import { requirePermissions, runInTenant } from "~/platform/session/requireUser.server";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — JS module
import { getRefundDashboardForUser } from "~/contexts/refunds/application/refundDashboardService.js";

import RefundDashboard from "~/shared/ui/RefundDashboard";

export function meta() {
  return [{ title: "Reembolsos — CocoConsulting" }];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requirePermissions(request, "travel_request:view_own");
  const data = await runInTenant(session, async () =>
    getRefundDashboardForUser(session.user.user_id),
  );
  return { userId: session.user.user_id, data };
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

export default function ReembolsoRoute() {
  const { userId, data } = useLoaderData() as LoaderData;
  return <RefundDashboard userId={userId} initialData={data as any} />;
}
