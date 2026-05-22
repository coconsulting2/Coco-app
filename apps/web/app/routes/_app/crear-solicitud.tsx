/**
 * @module crear-solicitud
 * @description Pantalla "Solicitar un viaje". Loader resuelve el centro de costos
 * del solicitante (DI) y el rol/permiso requerido. El formulario en sí
 * (`TravelRequestForm`) es el legacy verbatim — sigue posteando vía apiClient
 * a `/api/applicant/create-travel-request/:user_id` (resource route migrado).
 *
 * Migración a `<Form>` action está en CLEANUP_PLAN §5 (Fase 6 hardening).
 */
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRouteLoaderData } from "react-router";

import { requirePermissions, runInTenant } from "~/platform/session/requireUser.server";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — JS module
import { getCostCenterForUser } from "~/contexts/travel-requests/application/applicantQueryService.js";

import TravelRequestForm from "~/shared/ui/TravelRequestForm";
import type { AppLayoutData } from "./_layout";

export function meta() {
  return [{ title: "Solicitar viaje — CocoConsulting" }];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requirePermissions(request, "travel_request:create");
  // Pre-cargar centro de costos del usuario (el formulario lo necesita).
  const costCenter = await runInTenant(session, async () =>
    getCostCenterForUser(session.user.user_id),
  );
  return {
    userId: session.user.user_id,
    costCenter,
  };
}

export default function CrearSolicitudRoute() {
  const data = useLoaderData() as Awaited<ReturnType<typeof loader>>;
  const layout = useRouteLoaderData("routes/_app/_layout") as AppLayoutData;

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">
          Coco / Solicitudes / Nueva
        </p>
        <h1 className="font-serif text-3xl md:text-4xl">Solicitar un viaje</h1>
        <p className="text-[var(--color-ink-muted)]">
          Complete el formulario para generar una nueva solicitud de viaje.
        </p>
      </header>

      <main className="card-editorial bg-white border border-[var(--color-neutral-200)] rounded-lg p-6 md:p-8">
        {/* TravelRequestForm legacy: posta a /api/applicant/create-travel-request/:user_id */}
        <TravelRequestForm
          user_id={String(data.userId)}
          mode="create"
          role={layout.user.role}
          token=""
        />
      </main>
    </section>
  );
}
