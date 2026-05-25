/**
 * @module todas-las-solicitudes
 * @description Vista global de Cuentas por Pagar: todas las solicitudes en el
 * historial CxP. El loader pide permiso `accounts_payable:attend` y carga la
 * data real vía el use-case `listAllCxpRequests` del slice accounts-payable.
 */
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import { requirePermissions, runInTenant } from "~/platform/session/requireUser.server";
import { listAllCxpRequests } from "~/contexts/accounts-payable";
import CxPAllRequestsList from "~/shared/ui/RequestsLists/CxPAllRequestsList";
import type { UserRole } from "~/shared/types/roles";

export function meta() {
  return [{ title: "Todas las solicitudes — CocoConsulting" }];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requirePermissions(request, "accounts_payable:attend");
  const role = session.user.role as UserRole;

  const rows = await runInTenant(session, async () => listAllCxpRequests());

  return { role, rows };
}

export default function PageRoute() {
  const { role, rows } = useLoaderData() as Awaited<ReturnType<typeof loader>>;

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">Coco / CxP</p>
        <h1 className="font-serif text-3xl md:text-4xl">Todas las solicitudes</h1>
      </header>
      <CxPAllRequestsList data={rows} role={role} />
    </section>
  );
}
