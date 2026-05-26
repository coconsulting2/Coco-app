/**
 * @module subir-comprobante.server
 * @description Handler server-only del ciclo de vida del comprobante (sin
 * `apiRequest`/`token`/`fetch('/api/...')`). Vive en un módulo `.server` para
 * que las rutas `subir-comprobante.$id` y `resubir-comprobante.$id` lo
 * compartan sin filtrar server-code al bundle de cliente (RR7 elimina server
 * code solo de `loader`/`action`; un export normal con `requireUser.server`
 * rompería el build).
 *
 *   intent="previewPolicy" → `previewExpensePolicy` (RF-44, sin tocar archivos).
 *   intent="policy-exception:create" → `createException` (RF-45).
 *   intent="submit" → multipart: crea receipt, descubre id, (resubmit) borra el
 *     anterior, sube a GridFS y persiste el CFDI (nacional SAT+EFOS / internacional).
 *
 * Paridad 1:1 con el legacy `ExpensesForm` + `comprobantesController.crearComprobante`.
 */
import {
  requirePermissions,
  runInRls,
  runInTenant,
} from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";
import {
  createExpenseValidationBatch,
  TravelRequestServiceError,
} from "~/contexts/travel-requests";
import {
  uploadReceiptFile,
  uploadInternationalReceiptImage,
  deleteReceiptFile,
  registerReceiptCfdi,
  registerInternationalReceipt,
  getReceiptsForRequestValidation,
  buildComprobanteRegistroBodyFromXml,
  ReceiptsCfdiError,
} from "~/contexts/receipts-cfdi";
import { previewExpensePolicy, createException, PoliciesError } from "~/contexts/policies";
import { receiptTypeIdForConcepto } from "~/shared/ui/SubmitTravelWarper";
import type { SubmitComprobanteActionResult } from "~/shared/types/comprobante";

function bad(intent: string, error: string, status = 400, code?: string): Response {
  return Response.json(
    { ok: false, intent, error, code } satisfies SubmitComprobanteActionResult,
    { status },
  );
}

async function fileToUploaded(file: File) {
  return {
    buffer: Buffer.from(await file.arrayBuffer()),
    fileName: file.name,
    contentType: file.type || "application/octet-stream",
  };
}

/** Localiza el receipt recién creado para la solicitud (mayor receiptId). */
async function findLastReceiptId(requestId: number): Promise<number | null> {
  const data = await getReceiptsForRequestValidation({ requestId });
  if (!data || data.items.length === 0) return null;
  return data.items.reduce((max, item) => Math.max(max, item.receiptId), 0) || null;
}

export async function handleSubirComprobanteAction(
  request: Request,
  requestId: number,
  options: { resubmit: boolean },
): Promise<Response> {
  const session = await requirePermissions(request, "expense:submit");
  await assertCsrf(request);

  if (!Number.isFinite(requestId) || requestId < 1) {
    return bad("unknown", "Request id inválido");
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  // ── Intent: preview de política (RF-44) ──────────────────────────────────
  if (intent === "previewPolicy") {
    const concepto = String(formData.get("concepto") ?? "");
    const amount = Number(formData.get("monto"));
    const currency = String(formData.get("currency") ?? "MXN");
    let receiptTypeId: number;
    try {
      receiptTypeId = receiptTypeIdForConcepto(concepto);
    } catch {
      // Concepto no mapeable → no bloqueamos (el backend revalida).
      return Response.json({
        ok: true,
        intent: "previewPolicy",
        preview: {
          exceeded: false,
          policyId: null,
          capId: null,
          capAmount: null,
          capUnit: null,
          currency,
          excessTotal: 0,
          message: "",
        },
      } satisfies SubmitComprobanteActionResult);
    }
    if (!Number.isFinite(amount)) {
      return bad("previewPolicy", "El monto debe ser un número válido.");
    }
    try {
      const preview = await runInTenant(session, async () =>
        previewExpensePolicy({ requestId, receiptTypeId, amount, currency }),
      );
      return Response.json({
        ok: true,
        intent: "previewPolicy",
        preview,
      } satisfies SubmitComprobanteActionResult);
    } catch (err) {
      // Preview nunca bloquea por fallo propio (paridad legacy: el submit revalida).
      const msg = err instanceof Error ? err.message : "preview failed";
      return bad("previewPolicy", msg, 200);
    }
  }

  // ── Intent: crear excepción de política (RF-45) ──────────────────────────
  // Paridad legacy `POST /refunds/exceptions` (refundController.createException):
  // permiso `expense:submit`, `requestedById` tomado de la sesión, no del body.
  if (intent === "policy-exception:create") {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(String(formData.get("payload") ?? "{}")) as Record<string, unknown>;
    } catch {
      return bad("policy-exception:create", "Payload de excepción inválido.");
    }
    const justification = String(parsed.justification ?? "").trim();
    const amountClaimed = Number(parsed.amountClaimed);
    const excessAmount = Number(parsed.excessAmount);
    if (!Number.isFinite(amountClaimed) || !Number.isFinite(excessAmount)) {
      return bad("policy-exception:create", "Montos de la excepción inválidos.");
    }
    const receiptId = parsed.receiptId != null ? Number(parsed.receiptId) : null;
    const policyId = parsed.policyId != null ? Number(parsed.policyId) : null;
    const capId = parsed.capId != null ? Number(parsed.capId) : null;
    const amountAllowed = parsed.amountAllowed != null ? Number(parsed.amountAllowed) : null;

    try {
      const created = await runInRls(session, async () =>
        createException({
          requestId,
          receiptId,
          policyId,
          capId,
          amountClaimed,
          amountAllowed,
          excessAmount,
          justification,
          requestedById: Number(session.user.user_id),
        }),
      );
      return Response.json({
        ok: true,
        intent: "policy-exception:create",
        exceptionId: created.exceptionId,
      } satisfies SubmitComprobanteActionResult);
    } catch (err) {
      if (err instanceof Response) return err;
      if (err instanceof PoliciesError) {
        return bad("policy-exception:create", err.message, err.status, err.code);
      }
      const status =
        typeof (err as { status?: unknown })?.status === "number"
          ? (err as { status: number }).status
          : 500;
      const msg = err instanceof Error ? err.message : "No se pudo crear la excepción.";
      return bad("policy-exception:create", msg, status);
    }
  }

  // ── Intent: submit (multipart con archivos) ──────────────────────────────
  if (intent !== "submit") {
    return bad(intent, `Intent desconocido: ${intent}`);
  }

  const concepto = String(formData.get("concepto") ?? "");
  const monto = Number(formData.get("monto"));
  const isInternational = String(formData.get("isInternational") ?? "") === "true";
  const intlCurrency = String(formData.get("intlCurrency") ?? "USD");
  const fechaComprobante = String(formData.get("fechaComprobante") ?? "").trim();
  const receiptToReplaceRaw = String(formData.get("receiptToReplace") ?? "").trim();
  const receiptToReplace = receiptToReplaceRaw ? Number(receiptToReplaceRaw) : null;

  // Validaciones de campos (paridad con getValidationErrors del legacy).
  if (!concepto) return bad("submit", "El concepto es obligatorio.");
  if (!Number.isFinite(monto)) return bad("submit", "El monto gastado debe ser un número válido.");

  const pdfEntry = formData.get("pdf");
  const xmlEntry = formData.get("xml");
  const pdf = pdfEntry instanceof File && pdfEntry.size > 0 ? pdfEntry : null;
  const xml = xmlEntry instanceof File && xmlEntry.size > 0 ? xmlEntry : null;

  if (!pdf) {
    return bad(
      "submit",
      isInternational
        ? "Debes adjuntar el comprobante en JPG o PNG."
        : "Debes adjuntar el comprobante en PDF.",
    );
  }
  if (!isInternational && !xml) {
    return bad("submit", "Debes adjuntar el archivo XML.");
  }

  let receiptTypeId: number;
  try {
    receiptTypeId = receiptTypeIdForConcepto(concepto);
  } catch (err) {
    return bad("submit", err instanceof Error ? err.message : "Concepto inválido");
  }

  // Para nacionales: extrae UUID del XML antes de crear el receipt (anti-dup).
  let cfdiUuid: string | null = null;
  let registroSugerido: Record<string, unknown> | null = null;
  if (!isInternational && xml) {
    const xmlText = await xml.text();
    try {
      registroSugerido = buildComprobanteRegistroBodyFromXml(xmlText) as Record<string, unknown>;
    } catch {
      registroSugerido = null;
    }
    const rawUuid = registroSugerido?.uuid;
    cfdiUuid = typeof rawUuid === "string" && rawUuid.trim() ? rawUuid.trim().toLowerCase() : null;
    if (!cfdiUuid) {
      return bad(
        "submit",
        "No se pudo leer el UUID del XML. Verifica que sea un CFDI con TimbreFiscalDigital válido.",
      );
    }
  }

  let emisionIntlIso: string | null = null;
  if (isInternational) {
    if (!fechaComprobante) {
      return bad("submit", "La fecha del comprobante es obligatoria para recibos internacionales.");
    }
    const emisionIntl = new Date(`${fechaComprobante}T12:00:00`);
    if (Number.isNaN(emisionIntl.getTime())) {
      return bad("submit", "La fecha del comprobante no es válida. Elige una fecha en el calendario.");
    }
    emisionIntlIso = emisionIntl.toISOString();
  }

  try {
    return await runInRls(session, async (): Promise<Response> => {
      // 1. Crear la fila receipt (valida UUID / anti-dup / estado solicitud).
      await createExpenseValidationBatch(
        [
          {
            receipt_type_id: receiptTypeId,
            request_id: requestId,
            amount: monto,
            ...(cfdiUuid ? { cfdi_uuid: cfdiUuid } : {}),
          },
        ],
        { allow_missing_cfdi_uuid: isInternational },
      );

      // 2. Descubrir el receiptId recién creado.
      const receiptId = await findLastReceiptId(requestId);
      if (!receiptId) {
        return bad("submit", "No se pudo crear el comprobante.", 500);
      }

      // 3. (resubmit) Borrar el comprobante anterior.
      if (options.resubmit && receiptToReplace && Number.isFinite(receiptToReplace)) {
        try {
          await deleteReceiptFile({ receiptId: receiptToReplace });
        } catch {
          /* best-effort: paridad legacy (sólo loguea, no bloquea) */
        }
      }

      // 4. Subir archivos a GridFS.
      if (isInternational) {
        await uploadInternationalReceiptImage({
          receiptId,
          image: await fileToUploaded(pdf),
        });
        // 5. Persistir comprobante internacional (sin SAT).
        await registerInternationalReceipt({
          receiptId,
          body: {
            fecha_emision: emisionIntlIso!,
            descripcion: `${concepto} — comprobante internacional`,
            total: monto,
            moneda: intlCurrency,
            receipt_type_id: receiptTypeId,
          },
        });
        return Response.json({
          ok: true,
          intent: "submit",
          receiptId,
          isInternational: true,
        } satisfies SubmitComprobanteActionResult);
      }

      await uploadReceiptFile({
        receiptId,
        pdf: await fileToUploaded(pdf),
        xml: await fileToUploaded(xml!),
      });

      // 5. Persistir CFDI nacional (SAT + EFOS server-side).
      if (registroSugerido) {
        const cfdiData = {
          ...registroSugerido,
          uuid: String(registroSugerido.uuid),
          rfc_emisor: String(registroSugerido.rfc_emisor),
          rfc_receptor: String(registroSugerido.rfc_receptor),
          total: Number(registroSugerido.total),
          receipt_type_id: receiptTypeId,
        };
        await registerReceiptCfdi({ receiptId, cfdiData });
      }

      return Response.json({
        ok: true,
        intent: "submit",
        receiptId,
        isInternational: false,
      } satisfies SubmitComprobanteActionResult);
    });
  } catch (err) {
    if (err instanceof Response) return err;
    if (err instanceof TravelRequestServiceError) {
      return bad("submit", err.message, err.status, err.code);
    }
    if (err instanceof ReceiptsCfdiError) {
      return bad("submit", err.message, err.status, err.code);
    }
    const msg = err instanceof Error ? err.message : "No se pudo registrar el comprobante.";
    return bad("submit", msg, 500);
  }
}
