/**
 * @module subir-comprobante.$id
 * @description Pantalla de subida de comprobante (solicitante). Renderiza
 * `ExpensesForm`; la orquestación server vive en `subir-comprobante.server`
 * (`handleSubirComprobanteAction`), compartida con `resubir-comprobante.$id`.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import { requirePermissions } from "~/platform/session/requireUser.server";
import { handleSubirComprobanteAction } from "~/routes/_app/subir-comprobante.server";
import ExpensesForm from "~/shared/ui/ExpensesForm";

export function meta() {
  return [{ title: "Subir comprobante — CocoConsulting" }];
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requirePermissions(request, "expense:submit");
  return { requestId: Number(params.id), resubmit: false };
}

export async function action({ request, params }: ActionFunctionArgs): Promise<Response> {
  return handleSubirComprobanteAction(request, Number(params.id), { resubmit: false });
}

export default function PageRoute() {
  const data = useLoaderData() as Awaited<ReturnType<typeof loader>>;

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">
          Coco / Comprobantes
        </p>
        <h1 className="font-serif text-3xl md:text-4xl">Subir comprobante</h1>
      </header>
      <ExpensesForm requestId={data.requestId} resubmit={data.resubmit} />
    </section>
  );
}
