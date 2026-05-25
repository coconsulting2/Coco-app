/**
 * @module XmlExpenseForm
 * @author Emiliano Deyta
 * @description Formulario de comprobación para un receipt YA existente: CFDI
 * nacional (XML parseado en servidor + SAT) o gasto internacional (imagen
 * JPG/PNG, sin UUID/SAT, conversión FX a MXN).
 *
 * Migrado a React Router 7: cero `apiRequest`, cero `token`, cero
 * `fetch('/api/...')`. Toda interacción con el servidor pasa por `useFetcher`
 * contra la action de la route padre, que debe implementar los intents:
 *
 *   intent="parseXml"            (multipart `xml`)      → autollena el form nacional.
 *   intent="fxPreview"           (`amount`,`currency`)  → equivalente aproximado en MXN.
 *   intent="registerNational"    (campos CFDI)          → `registerReceiptCfdi`.
 *   intent="registerInternational" (multipart `image` + campos) → upload + `registerInternationalReceipt`.
 *
 * Es prop-driven: recibe `receiptId` y notifica `onSuccess`. La revalidación
 * del loader del padre es automática tras un submit exitoso.
 */
import { useEffect, useState } from "react";
import { useForm, type Resolver, type SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFetcher } from "react-router";
import { EXPENSE_TYPES } from "~/shared/config/expenseForm";
import type { ParsedXmlData } from "~/shared/config/expenseForm";

const expenseSchema = z.object({
  rfc_emisor: z
    .string()
    .min(12, "RFC debe tener al menos 12 caracteres")
    .max(13, "RFC no puede exceder 13 caracteres"),
  fecha_emision: z.string().min(1, "Fecha de emisión es requerida"),
  monto_total: z.coerce.number().positive("El monto debe ser mayor a 0"),
  uuid: z.string().min(1, "UUID es requerido"),
  receipt_type_id: z.coerce.number().min(1, "Selecciona un tipo de gasto"),
  notas: z.string().optional(),
});

const internationalSchema = z.object({
  descripcion: z.string().min(3, "Describe el gasto").max(254),
  fecha_emision: z.string().min(1, "Fecha es requerida"),
  monto_total: z.coerce.number().positive("El monto debe ser mayor a 0"),
  moneda: z.enum(["USD", "EUR", "GBP", "JPY", "CAD"]),
  receipt_type_id: z.coerce.number().min(1, "Selecciona un tipo de gasto"),
  notas: z.string().optional(),
});

type ExpenseFormData = z.infer<typeof expenseSchema>;
type InternationalFormData = z.infer<typeof internationalSchema>;

/**
 * Forma de la respuesta del action de la route padre. Discriminada por
 * `intent`. La route debe responder con `Response.json(...)` de estas formas.
 */
export type XmlExpenseFetcherResult =
  | { ok: true; intent: "parseXml"; parsed: ParsedXmlData }
  | { ok: true; intent: "fxPreview"; convertedMxn: number }
  | { ok: true; intent: "registerNational" | "registerInternational"; receiptId: number }
  | { ok: false; intent: string; error: string; code?: string };

interface Props {
  receiptId: number;
  onSuccess?: () => void;
}

export default function XmlExpenseForm({ receiptId, onSuccess }: Props) {
  const fetcher = useFetcher<XmlExpenseFetcherResult>();

  const [isInternational, setIsInternational] = useState(false);
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [registroSugerido, setRegistroSugerido] = useState<Record<string, unknown> | null>(null);
  const [fxMxn, setFxMxn] = useState<number | null>(null);

  const busy = fetcher.state !== "idle";
  const submitting =
    busy &&
    (fetcher.formData?.get("intent") === "registerNational" ||
      fetcher.formData?.get("intent") === "registerInternational");
  const parsing = busy && fetcher.formData?.get("intent") === "parseXml";
  const fxLoading = busy && fetcher.formData?.get("intent") === "fxPreview";

  const nationalForm = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema) as Resolver<ExpenseFormData>,
    defaultValues: {
      rfc_emisor: "",
      fecha_emision: "",
      monto_total: 0,
      uuid: "",
      receipt_type_id: 0,
      notas: "",
    },
  });

  const intlForm = useForm<InternationalFormData>({
    resolver: zodResolver(internationalSchema) as Resolver<InternationalFormData>,
    defaultValues: {
      descripcion: "",
      fecha_emision: new Date().toISOString().slice(0, 10),
      monto_total: 0,
      moneda: "USD",
      receipt_type_id: 0,
      notas: "",
    },
  });

  const intlMonto = intlForm.watch("monto_total");
  const intlMoneda = intlForm.watch("moneda");

  // ── FX preview (debounced) vía action ────────────────────────────────────
  useEffect(() => {
    if (!isInternational) {
      setFxMxn(null);
      return;
    }
    const amt = Number(intlMonto);
    if (!intlMoneda || !Number.isFinite(amt) || amt <= 0) {
      setFxMxn(null);
      return;
    }
    const t = setTimeout(() => {
      const fd = new FormData();
      fd.set("intent", "fxPreview");
      fd.set("amount", String(amt));
      fd.set("currency", intlMoneda);
      fetcher.submit(fd, { method: "post" });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInternational, intlMonto, intlMoneda]);

  // ── Reacción a las respuestas del action ─────────────────────────────────
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    const data = fetcher.data;

    if (data.ok && data.intent === "parseXml") {
      nationalForm.reset({
        rfc_emisor: data.parsed.rfc_emisor,
        fecha_emision: data.parsed.fecha_emision,
        monto_total: data.parsed.monto_total,
        uuid: data.parsed.uuid,
        receipt_type_id: 0,
        notas: "",
      });
      setRegistroSugerido((data.parsed.registro_sugerido as Record<string, unknown>) ?? null);
      setParseError(null);
      return;
    }

    if (data.ok && data.intent === "fxPreview") {
      setFxMxn(typeof data.convertedMxn === "number" ? data.convertedMxn : null);
      return;
    }

    if (data.ok && (data.intent === "registerNational" || data.intent === "registerInternational")) {
      onSuccess?.();
      return;
    }

    if (!data.ok) {
      if (data.intent === "fxPreview") {
        setFxMxn(null);
      } else if (data.intent === "parseXml") {
        setParseError("No se pudo procesar el archivo XML. Verifica que sea un CFDI válido.");
      } else {
        setParseError(data.error);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.state, fetcher.data]);

  const handleXmlUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setXmlFile(file);
    setParseError(null);
    setRegistroSugerido(null);
    const fd = new FormData();
    fd.set("intent", "parseXml");
    fd.set("xml", file);
    fetcher.submit(fd, { method: "post", encType: "multipart/form-data" });
  };

  const onNationalSubmit: SubmitHandler<ExpenseFormData> = (data) => {
    setParseError(null);
    const fe = new Date(data.fecha_emision);
    if (Number.isNaN(fe.getTime())) {
      setParseError("La fecha de emisión no es válida.");
      return;
    }
    const fd = new FormData();
    fd.set("intent", "registerNational");
    fd.set("receiptId", String(receiptId));
    fd.set("rfc_emisor", data.rfc_emisor);
    fd.set("uuid", data.uuid);
    fd.set("fecha_emision", fe.toISOString());
    fd.set("monto_total", String(data.monto_total));
    fd.set("receipt_type_id", String(data.receipt_type_id));
    if (data.notas?.trim()) fd.set("notas", data.notas.trim());
    if (registroSugerido) fd.set("registro_sugerido", JSON.stringify(registroSugerido));
    fetcher.submit(fd, { method: "post" });
  };

  const onInternationalSubmit: SubmitHandler<InternationalFormData> = (data) => {
    setParseError(null);
    if (!imageFile) {
      setParseError("Adjunta una imagen JPG o PNG del recibo.");
      return;
    }
    const emisionIntl = new Date(`${data.fecha_emision}T12:00:00`);
    if (Number.isNaN(emisionIntl.getTime())) {
      setParseError("La fecha de emisión no es válida.");
      return;
    }
    const fd = new FormData();
    fd.set("intent", "registerInternational");
    fd.set("receiptId", String(receiptId));
    fd.set("image", imageFile);
    fd.set("descripcion", data.descripcion);
    fd.set("monto_total", String(data.monto_total));
    fd.set("moneda", data.moneda);
    fd.set("fecha_emision", emisionIntl.toISOString());
    fd.set("receipt_type_id", String(data.receipt_type_id));
    if (data.notas) fd.set("notas", data.notas);
    fetcher.submit(fd, { method: "post", encType: "multipart/form-data" });
  };

  const inputBase =
    "w-full border rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors";

  const readonlyClass =
    "bg-[var(--color-surface-secondary)] text-[var(--color-ink-muted)] cursor-not-allowed";

  return (
    <div className="card-editorial p-6 md:p-8">
      <label className="flex items-center gap-2 text-sm font-medium text-[var(--color-ink-secondary)] mb-4 cursor-pointer">
        <input
          type="checkbox"
          checked={isInternational}
          onChange={(e) => {
            setIsInternational(e.target.checked);
            setParseError(null);
            setXmlFile(null);
            setImageFile(null);
          }}
          className="accent-primary-400"
        />
        Gasto internacional
      </label>

      {!isInternational && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-[var(--color-ink-secondary)] mb-1.5">
            Archivo XML del CFDI <span className="text-accent-400">*</span>
          </label>
          <input
            type="file"
            accept=".xml"
            onChange={handleXmlUpload}
            disabled={parsing}
            className="block w-full text-sm text-[var(--color-ink-muted)] file:mr-4 file:py-2 file:px-4 file:rounded-[var(--radius-md)] file:border-0 file:text-sm file:font-medium file:bg-primary-100 file:text-primary-500 hover:file:bg-primary-200 file:cursor-pointer file:transition-colors"
          />
          {parsing && (
            <p className="text-xs text-[var(--color-ink-muted)] mt-1 animate-pulse">
              Procesando XML...
            </p>
          )}
          {xmlFile && !parsing && !parseError && (
            <p className="text-xs text-success-500 mt-1">{xmlFile.name} cargado correctamente</p>
          )}
        </div>
      )}

      {isInternational && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-[var(--color-ink-secondary)] mb-1.5">
            Imagen del recibo (JPG / PNG) <span className="text-accent-400">*</span>
          </label>
          <input
            type="file"
            accept="image/jpeg,image/png"
            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-[var(--color-ink-muted)] file:mr-4 file:py-2 file:px-4 file:rounded-[var(--radius-md)] file:border-0 file:text-sm file:font-medium file:bg-primary-100 file:text-primary-500 hover:file:bg-primary-200 file:cursor-pointer file:transition-colors"
          />
          {imageFile && (
            <p className="text-xs text-success-500 mt-1">{imageFile.name} seleccionada</p>
          )}
        </div>
      )}

      {parseError && <p className="text-xs text-accent-400 mb-4">{parseError}</p>}

      {!isInternational ? (
        <form onSubmit={nationalForm.handleSubmit(onNationalSubmit)} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-[var(--color-ink-secondary)] mb-1.5">
                RFC Emisor
              </label>
              <input
                {...nationalForm.register("rfc_emisor")}
                readOnly
                className={`${inputBase} ${readonlyClass}`}
                placeholder="Se llenará al subir XML"
              />
              {nationalForm.formState.errors.rfc_emisor && (
                <p className="text-xs text-accent-400 mt-1">
                  {nationalForm.formState.errors.rfc_emisor.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-ink-secondary)] mb-1.5">
                UUID
              </label>
              <input
                {...nationalForm.register("uuid")}
                readOnly
                className={`${inputBase} ${readonlyClass}`}
                placeholder="Se llenará al subir XML"
              />
              {nationalForm.formState.errors.uuid && (
                <p className="text-xs text-accent-400 mt-1">
                  {nationalForm.formState.errors.uuid.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-[var(--color-ink-secondary)] mb-1.5">
                Fecha de Emisión <span className="text-accent-400">*</span>
              </label>
              <input
                {...nationalForm.register("fecha_emision")}
                type="datetime-local"
                className={`${inputBase} ${nationalForm.formState.errors.fecha_emision ? "border-accent-400" : "border-[var(--color-neutral-300)]"}`}
              />
              {nationalForm.formState.errors.fecha_emision && (
                <p className="text-xs text-accent-400 mt-1">
                  {nationalForm.formState.errors.fecha_emision.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-ink-secondary)] mb-1.5">
                Monto Total <span className="text-accent-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-ink-muted)]">
                  $
                </span>
                <input
                  {...nationalForm.register("monto_total")}
                  type="number"
                  step="0.01"
                  min="0"
                  className={`${inputBase} pl-7 ${nationalForm.formState.errors.monto_total ? "border-accent-400" : "border-[var(--color-neutral-300)]"}`}
                />
              </div>
              {nationalForm.formState.errors.monto_total && (
                <p className="text-xs text-accent-400 mt-1">
                  {nationalForm.formState.errors.monto_total.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-ink-secondary)] mb-1.5">
              Tipo de Gasto <span className="text-accent-400">*</span>
            </label>
            <select
              {...nationalForm.register("receipt_type_id")}
              className={`${inputBase} ${nationalForm.formState.errors.receipt_type_id ? "border-accent-400" : "border-[var(--color-neutral-300)]"}`}
            >
              <option value={0}>Seleccionar tipo de gasto</option>
              {EXPENSE_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
            {nationalForm.formState.errors.receipt_type_id && (
              <p className="text-xs text-accent-400 mt-1">
                {nationalForm.formState.errors.receipt_type_id.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-ink-secondary)] mb-1.5">
              Notas <span className="text-[var(--color-ink-muted)]">(opcional)</span>
            </label>
            <textarea
              {...nationalForm.register("notas")}
              rows={3}
              className={`${inputBase} border-[var(--color-neutral-300)] resize-none`}
              placeholder="Observaciones adicionales..."
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 text-sm font-medium rounded-[var(--radius-md)] bg-primary-500 text-white hover:bg-primary-400 active:bg-primary-300 transition-all duration-200 focus:ring-2 focus:ring-primary-200 focus:ring-offset-1 disabled:bg-neutral-300 disabled:text-neutral-400 disabled:cursor-not-allowed"
            >
              {submitting ? "Guardando..." : "Guardar Comprobación"}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={intlForm.handleSubmit(onInternationalSubmit)} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-[var(--color-ink-secondary)] mb-1.5">
              Descripción del gasto <span className="text-accent-400">*</span>
            </label>
            <input
              {...intlForm.register("descripcion")}
              className={`${inputBase} ${intlForm.formState.errors.descripcion ? "border-accent-400" : "border-[var(--color-neutral-300)]"}`}
              placeholder="Ej. Hotel London Heathrow"
            />
            {intlForm.formState.errors.descripcion && (
              <p className="text-xs text-accent-400 mt-1">
                {intlForm.formState.errors.descripcion.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-[var(--color-ink-secondary)] mb-1.5">
                Fecha <span className="text-accent-400">*</span>
              </label>
              <input
                {...intlForm.register("fecha_emision")}
                type="date"
                className={`${inputBase} ${intlForm.formState.errors.fecha_emision ? "border-accent-400" : "border-[var(--color-neutral-300)]"}`}
              />
              {intlForm.formState.errors.fecha_emision && (
                <p className="text-xs text-accent-400 mt-1">
                  {intlForm.formState.errors.fecha_emision.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-ink-secondary)] mb-1.5">
                Moneda <span className="text-accent-400">*</span>
              </label>
              <select
                {...intlForm.register("moneda")}
                className={`${inputBase} border-[var(--color-neutral-300)]`}
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="JPY">JPY</option>
                <option value="CAD">CAD</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-ink-secondary)] mb-1.5">
              Monto <span className="text-accent-400">*</span>
            </label>
            <input
              {...intlForm.register("monto_total")}
              type="number"
              step="0.01"
              min="0"
              className={`${inputBase} ${intlForm.formState.errors.monto_total ? "border-accent-400" : "border-[var(--color-neutral-300)]"}`}
            />
            {intlForm.formState.errors.monto_total && (
              <p className="text-xs text-accent-400 mt-1">
                {intlForm.formState.errors.monto_total.message}
              </p>
            )}
            <p className="text-xs text-[var(--color-ink-muted)] mt-1">
              {fxLoading && "Calculando tipo de cambio…"}
              {!fxLoading && fxMxn != null && (
                <>
                  Equivalente aproximado:{" "}
                  <strong>
                    {fxMxn.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}
                  </strong>
                </>
              )}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-ink-secondary)] mb-1.5">
              Tipo de Gasto <span className="text-accent-400">*</span>
            </label>
            <select
              {...intlForm.register("receipt_type_id")}
              className={`${inputBase} ${intlForm.formState.errors.receipt_type_id ? "border-accent-400" : "border-[var(--color-neutral-300)]"}`}
            >
              <option value={0}>Seleccionar tipo de gasto</option>
              {EXPENSE_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
            {intlForm.formState.errors.receipt_type_id && (
              <p className="text-xs text-accent-400 mt-1">
                {intlForm.formState.errors.receipt_type_id.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-ink-secondary)] mb-1.5">
              Notas <span className="text-[var(--color-ink-muted)]">(opcional)</span>
            </label>
            <textarea
              {...intlForm.register("notas")}
              rows={3}
              className={`${inputBase} border-[var(--color-neutral-300)] resize-none`}
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 text-sm font-medium rounded-[var(--radius-md)] bg-primary-500 text-white hover:bg-primary-400 active:bg-primary-300 transition-all duration-200 focus:ring-2 focus:ring-primary-200 focus:ring-offset-1 disabled:bg-neutral-300 disabled:text-neutral-400 disabled:cursor-not-allowed"
            >
              {submitting ? "Guardando..." : "Guardar comprobación internacional"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
