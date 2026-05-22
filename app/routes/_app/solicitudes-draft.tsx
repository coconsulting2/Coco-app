/**
 * @module solicitudes-draft
 * @description Listado de borradores (solicitudes sin enviar). DI a `Applicant.getApplicantRequests`
 * filtrado por status_id = 1 (Borrador).
 */
import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";

import { requirePermissions, runInTenant } from "~/platform/session/requireUser.server";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — JS module
import { listDrafts } from "~/contexts/travel-requests/application/applicantQueryService.js";

export function meta() {
  return [{ title: "Borradores — CocoConsulting" }];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requirePermissions(request, "travel_request:create");
  const drafts = await runInTenant(session, async () => listDrafts(session.user.user_id));
  return { drafts };
}

type DraftRow = {
  request_id: number;
  status?: string;
  destination_country?: string | null;
  beginning_date?: string | Date | null;
  ending_date?: string | Date | null;
};

export default function SolicitudesDraftRoute() {
  const { drafts } = useLoaderData() as { drafts: DraftRow[] };

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">
          Coco / Borradores
        </p>
        <h1 className="font-serif text-3xl md:text-4xl">Borradores sin enviar</h1>
        <p className="text-[var(--color-ink-muted)]">
          Solicitudes que dejaste a medio camino y aún puedes confirmar.
        </p>
      </header>

      {drafts.length === 0 ? (
        <article className="text-center py-16 border border-dashed border-[var(--color-neutral-200)] rounded-lg">
          <p className="text-[var(--color-ink-muted)]">No tienes borradores guardados.</p>
        </article>
      ) : (
        <ul className="grid gap-3">
          {drafts.map((r) => (
            <li key={r.request_id}>
              <Link
                to={`/completar-draft/${r.request_id}`}
                className="block bg-white border border-[var(--color-neutral-200)] rounded-lg p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <p className="font-medium">Borrador #{r.request_id}</p>
                    <p className="text-sm text-[var(--color-ink-muted)]">
                      {r.destination_country ?? "Destino sin especificar"}
                    </p>
                  </div>
                  <span className="status-pill text-xs uppercase tracking-widest text-[var(--color-primary-700)] bg-[var(--color-primary-100)] px-2 py-1 rounded">
                    Continuar
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
