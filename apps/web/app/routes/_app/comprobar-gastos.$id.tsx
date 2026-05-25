/**
 * @module comprobar-gastos.$id
 * @description Página CxP: valida los receipts asociados a UNA solicitud.
 * Loader carga la lista vía `getReceiptsForRequestValidation`; action
 * discrimina por `intent` (approve | reject) y llama a `validateReceiptDecision`
 * del slice receipts-cfdi. Usa `runInRls` (transaccional) para mutaciones —
 * paridad 1:1 con el legacy `accountsPayableController.validateReceipt`
 * (SAT lookup vigente + EFOS, comentario obligatorio en reject, sync de
 * status de solicitud, post de comentario a chat).
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import {
  requirePermissions,
  runInRls,
  runInTenant,
} from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";
import {
  getReceiptsForRequestValidation,
  validateReceiptDecision,
  ReceiptsCfdiError,
  type RequestReceiptsForValidation,
} from "~/contexts/receipts-cfdi";
import ReceiptItem from "~/shared/ui/ReceiptItem";

export function meta() {
  return [{ title: "Validar comprobantes — CocoConsulting" }];
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const session = await requirePermissions(request, "receipt:validate");
  const requestId = Number(params.id);
  if (!Number.isFinite(requestId) || requestId < 1) {
    throw new Response("Request id inválido", { status: 400 });
  }
  const data = await runInTenant(session, async () =>
    getReceiptsForRequestValidation({ requestId }),
  );
  if (!data) {
    throw new Response("Solicitud no encontrada", { status: 404 });
  }
  return { receipts: data };
}

export type ValidateReceiptActionResult =
  | { ok: true; receiptId: number; newValidation: "Aprobado" | "Rechazado" }
  | { ok: false; error: string; code?: string };

export async function action({
  request,
  params,
}: ActionFunctionArgs): Promise<Response> {
  const session = await requirePermissions(request, "receipt:validate");
  await assertCsrf(request);

  const requestId = Number(params.id);
  if (!Number.isFinite(requestId) || requestId < 1) {
    return Response.json(
      { ok: false, error: "Request id inválido" } satisfies ValidateReceiptActionResult,
      { status: 400 },
    );
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const receiptId = Number(formData.get("receiptId"));

  if (!Number.isFinite(receiptId) || receiptId < 1) {
    return Response.json(
      { ok: false, error: "Receipt id inválido" } satisfies ValidateReceiptActionResult,
      { status: 400 },
    );
  }

  try {
    if (intent === "approve") {
      const result = await runInRls(session, async () =>
        validateReceiptDecision({
          receiptId,
          decision: "approve",
          userId: Number(session.user.user_id),
        }),
      );
      return Response.json(
        {
          ok: true,
          receiptId: result.receiptId,
          newValidation: result.newValidation,
        } satisfies ValidateReceiptActionResult,
        { status: 200 },
      );
    }

    if (intent === "reject") {
      const comentario = String(formData.get("comentario") ?? "").trim();
      const result = await runInRls(session, async () =>
        validateReceiptDecision({
          receiptId,
          decision: "reject",
          comment: comentario,
          userId: Number(session.user.user_id),
        }),
      );
      return Response.json(
        {
          ok: true,
          receiptId: result.receiptId,
          newValidation: result.newValidation,
        } satisfies ValidateReceiptActionResult,
        { status: 200 },
      );
    }

    return Response.json(
      {
        ok: false,
        error: `Intent desconocido: ${intent}`,
      } satisfies ValidateReceiptActionResult,
      { status: 400 },
    );
  } catch (err) {
    if (err instanceof Response) throw err;
    if (err instanceof ReceiptsCfdiError) {
      return Response.json(
        {
          ok: false,
          error: err.message,
          code: err.code,
        } satisfies ValidateReceiptActionResult,
        { status: err.status },
      );
    }
    const msg = err instanceof Error ? err.message : "No se pudo completar la acción.";
    return Response.json(
      { ok: false, error: msg } satisfies ValidateReceiptActionResult,
      { status: 500 },
    );
  }
}

export default function PageRoute() {
  const { receipts } = useLoaderData() as { receipts: RequestReceiptsForValidation };

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">
          Coco / Comprobaciones / #{receipts.requestId}
        </p>
        <h1 className="font-serif text-3xl md:text-4xl">Validar comprobantes</h1>
        {receipts.requestStatusName ? (
          <p className="text-sm text-[var(--color-ink-muted)]">
            Solicitud #{receipts.requestId} · Estado: {receipts.requestStatusName}
          </p>
        ) : (
          <p className="text-sm text-[var(--color-ink-muted)]">
            Solicitud #{receipts.requestId}
          </p>
        )}
      </header>

      {receipts.items.length === 0 ? (
        <div className="card-editorial p-6">
          <p className="text-sm text-[var(--color-ink-muted)]">
            Esta solicitud aún no tiene comprobantes registrados.
          </p>
        </div>
      ) : (
        <div className="card-editorial overflow-hidden">
          {receipts.items.map((item, index) => (
            <ReceiptItem
              key={item.receiptId}
              index={index}
              receiptId={item.receiptId}
              requestId={receipts.requestId}
              receiptTypeName={item.receiptTypeName}
              amount={item.amount}
              validation={item.validation}
              cfdi={item.cfdi}
              pdf={item.pdfFileId && item.pdfFileName ? { fileId: item.pdfFileId, fileName: item.pdfFileName } : null}
              xml={item.xmlFileId && item.xmlFileName ? { fileId: item.xmlFileId, fileName: item.xmlFileName } : null}
              apiBaseUrl="/api"
              isLast={index === receipts.items.length - 1}
            />
          ))}
        </div>
      )}
    </section>
  );
}
