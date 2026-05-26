/**
 * @module solicitudes-draft
 * @description Listado de borradores (solicitudes sin enviar). DI a `Applicant.getApplicantRequests`
 * filtrado por status_id = 1 (Borrador).
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";

import {
  requirePermissions,
  runInRls,
  runInTenant,
} from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";
import { listDrafts } from "~/contexts/travel-requests/application/applicantQueryService.js";
import {
  cancelTravelRequest,
  TravelRequestError,
} from "~/contexts/travel-requests/index.js";
import CancelRequestModal from "~/shared/ui/CancelRequestModal";
import MaterialIcon from "~/shared/ui/MaterialIcon";

export function meta() {
  return [{ title: "Borradores — CocoConsulting" }];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requirePermissions(request, "travel_request:create");
  const drafts = await runInTenant(session, async () => listDrafts(session.user.user_id));
  return { drafts };
}

export async function action({ request }: ActionFunctionArgs): Promise<Response> {
  const session = await requirePermissions(request, "travel_request:create");
  await assertCsrf(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent !== "cancel") {
    return Response.json({ ok: false, error: `Intent desconocido: ${intent}` }, { status: 400 });
  }

  const requestId = Number(formData.get("requestId"));
  if (!Number.isFinite(requestId) || requestId < 1) {
    return Response.json({ ok: false, error: "ID inválido" }, { status: 400 });
  }

  try {
    await runInRls(session, async () => cancelTravelRequest({ requestId }));
    return Response.json({ ok: true }, { status: 200 });
  } catch (err) {
    if (err instanceof Response) throw err;
    if (err instanceof TravelRequestError) {
      return Response.json({ ok: false, error: err.message, code: err.code }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : "No se pudo cancelar el borrador.";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
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
            <li
              key={r.request_id}
              className="flex items-center gap-3 bg-white border border-[var(--color-neutral-200)] rounded-lg p-4 hover:shadow-sm transition-shadow"
            >
              <Link
                to={`/completar-draft/${r.request_id}`}
                className="block flex-1 min-w-0"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="min-w-0">
                    <p className="font-medium">Borrador #{r.request_id}</p>
                    <p className="text-sm text-[var(--color-ink-muted)]">
                      {r.destination_country ?? "Destino sin especificar"}
                    </p>
                  </div>
                  <span className="status-pill text-xs uppercase tracking-widest text-[var(--color-primary-700)] bg-[var(--color-primary-100)] px-2 py-1 rounded shrink-0">
                    Continuar
                  </span>
                </div>
              </Link>
              <CancelRequestModal id={r.request_id}>
                <div
                  className="p-1.5 rounded-[var(--radius-md)] text-[var(--color-ink-muted)] hover:bg-accent-50 hover:text-accent-400 transition-colors cursor-pointer"
                  aria-label="Eliminar borrador"
                >
                  <MaterialIcon icon="delete" color="currentColor" />
                </div>
              </CancelRequestModal>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
