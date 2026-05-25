/**
 * @module resubir-comprobante.$id
 * @description Re-subida de comprobante. Mismo flujo que
 * `subir-comprobante.$id` con `resubmit` activado: la action borra el
 * comprobante anterior (`deleteReceiptFile`) antes de subir el nuevo.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import { requirePermissions } from "~/platform/session/requireUser.server";
import {
  handleSubirComprobanteAction,
  type SubmitComprobanteActionResult,
  type PolicyPreviewResult,
} from "~/routes/_app/subir-comprobante.$id";
import ExpensesForm from "~/shared/ui/ExpensesForm";

export type { SubmitComprobanteActionResult, PolicyPreviewResult };

export function meta() {
  return [{ title: "Resubir comprobante — CocoConsulting" }];
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requirePermissions(request, "expense:submit");
  return { requestId: Number(params.id), resubmit: true };
}

export async function action({ request, params }: ActionFunctionArgs): Promise<Response> {
  return handleSubirComprobanteAction(request, Number(params.id), { resubmit: true });
}

export default function PageRoute() {
  const data = useLoaderData() as Awaited<ReturnType<typeof loader>>;

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">
          Coco / Comprobantes
        </p>
        <h1 className="font-serif text-3xl md:text-4xl">Resubir comprobante</h1>
      </header>
      <ExpensesForm requestId={data.requestId} resubmit={data.resubmit} />
    </section>
  );
}
