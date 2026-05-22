/**
 * @module subir-comprobante.$id
 * @description Pantalla de subida de comprobante. Loader: pide permiso.
 * Action: discriminado por `intent`. Hoy soporta `validateCfdi` (consulta
 * SAT del UUID + RFCs + total). La subida de archivos PDF/XML/imagen y la
 * persistencia del Comprobante siguen pasando por endpoints públicos del
 * contrato Swagger M1 (`/api/files/*` y `/api/comprobantes/*`) hasta que
 * el slice receipts-cfdi se migre completo a hexagonal.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import {
  requirePermissions,
  runInTenant,
} from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";
import {
  validateCfdiUpload,
  ReceiptsCfdiError,
  type CfdiVerdict,
} from "~/contexts/receipts-cfdi";
import UploadReceiptFiles from "~/shared/ui/UploadReceiptFiles";

export function meta() {
  return [{ title: "Subir comprobante — CocoConsulting" }];
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requirePermissions(request, "expense:submit");
  return { requestId: Number(params.id) };
}

export type SatValidationActionResult =
  | {
      ok: true;
      intent: "validateCfdi";
      verdict: CfdiVerdict;
      acuse: {
        codigoEstatus: string;
        estado: string;
        esCancelable: string;
        estatusCancelacion: string;
        validacionEFOS: string;
      };
    }
  | { ok: false; intent: string; error: string };

export async function action({ request }: ActionFunctionArgs): Promise<Response> {
  const session = await requirePermissions(request, "expense:submit");
  await assertCsrf(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent !== "validateCfdi") {
    return Response.json(
      { ok: false, intent, error: `Intent desconocido: ${intent}` } satisfies SatValidationActionResult,
      { status: 400 },
    );
  }

  const rfcEmisor = String(formData.get("rfcEmisor") ?? "").trim();
  const rfcReceptor = String(formData.get("rfcReceptor") ?? "").trim();
  const uuid = String(formData.get("uuid") ?? "").trim();
  const total = Number(formData.get("total"));
  const selloUltimos8Raw = formData.get("selloUltimos8");
  const selloUltimos8 =
    typeof selloUltimos8Raw === "string" && selloUltimos8Raw.trim().length >= 8
      ? selloUltimos8Raw.trim()
      : null;

  if (!rfcEmisor || !rfcReceptor || !uuid || !Number.isFinite(total) || total <= 0) {
    return Response.json(
      {
        ok: false,
        intent,
        error: "Faltan campos del CFDI (rfcEmisor, rfcReceptor, uuid, total).",
      } satisfies SatValidationActionResult,
      { status: 400 },
    );
  }

  try {
    const result = await runInTenant(session, async () =>
      validateCfdiUpload({
        rfcEmisor,
        rfcReceptor,
        total,
        uuid,
        selloUltimos8,
      }),
    );
    return Response.json({
      ok: true,
      intent: "validateCfdi",
      verdict: result.verdict,
      acuse: result.acuse,
    } satisfies SatValidationActionResult);
  } catch (err) {
    if (err instanceof ReceiptsCfdiError) {
      return Response.json(
        { ok: false, intent, error: err.message } satisfies SatValidationActionResult,
        { status: err.status },
      );
    }
    const msg = err instanceof Error ? err.message : "No se pudo validar el CFDI ante el SAT.";
    return Response.json(
      { ok: false, intent, error: msg } satisfies SatValidationActionResult,
      { status: 502 },
    );
  }
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
      <UploadReceiptFiles requestId={data.requestId} />
    </section>
  );
}
