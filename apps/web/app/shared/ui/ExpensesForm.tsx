/**
 * @module ExpensesForm
 * @description Formulario de comprobación del solicitante (CFDI nacional o
 * gasto internacional). Migrado a React Router 7: ya no usa `apiRequest`,
 * `token`, ni la subida imperativa de `FileDropZone`. Toda la orquestación
 * (preview de política → crear receipt → subir archivos → registrar CFDI)
 * ocurre en la action de la route padre (`subir-comprobante.$id` /
 * `resubir-comprobante.$id`); aquí sólo se arma el `FormData` multipart y se
 * envía con `useFetcher`. Paridad 1:1 con el flujo legacy.
 */
import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import FileDropZone from "~/shared/ui/FileDropZone";
import { isDevTaxPreviewEnabled } from "~/shared/ui/CfdiDevPreview";
import UploadSuccessCard from "~/shared/ui/UploadSuccessCard";
import Button from "~/shared/ui/Button";
import ModalWrapper from "~/shared/ui/ModalWrapper";
import PolicyAlert from "~/shared/ui/PolicyAlert";
import PolicyExceptionModal from "~/shared/ui/PolicyExceptionModal";
import { extractCfdiTotalFromXml } from "~/shared/utils/cfdiXml";
import { showAppAlert } from "~/shared/utils/appAlert";
import { CONCEPTO_OPTIONS } from "~/shared/ui/SubmitTravelWarper";
import type {
  PolicyPreviewResult,
  SubmitComprobanteActionResult,
} from "~/shared/types/comprobante";

interface Props {
  requestId: number;
  /** Modo re-subida: la action borra el comprobante anterior antes de subir. */
  resubmit?: boolean;
  /** ID del receipt a reemplazar (modo resubmit). */
  receiptToReplace?: string | null;
}

type IntlCurrency = "USD" | "EUR" | "GBP" | "JPY" | "CAD";

export default function ExpensesForm({ requestId, resubmit = false, receiptToReplace }: Props) {
  const fetcher = useFetcher<SubmitComprobanteActionResult>();

  const [concepto, setConcepto] = useState("Transporte");
  const [monto, setMonto] = useState("");
  const [showValidation, setShowValidation] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [isInternational, setIsInternational] = useState(false);
  const [intlCurrency, setIntlCurrency] = useState<IntlCurrency>("USD");
  const [fechaComprobante, setFechaComprobante] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [completedConcepto, setCompletedConcepto] = useState("");
  const [completedReceiptId, setCompletedReceiptId] = useState<number | null>(null);
  const [completedInternational, setCompletedInternational] = useState(false);

  // M2-006 RF-44 — preview de política y modal de excepción.
  const [policyPreview, setPolicyPreview] = useState<PolicyPreviewResult | null>(null);
  const [showExceptionModal, setShowExceptionModal] = useState(false);
  const [exceptionAuthorized, setExceptionAuthorized] = useState(false);
  /** true cuando el usuario confirmó el submit y esperamos el preview para encadenar. */
  const pendingSubmitRef = useRef(false);

  const showDevPanel = isDevTaxPreviewEnabled();
  const submitting = fetcher.state !== "idle";

  // ── Reacción a la respuesta del action ───────────────────────────────────
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    const data = fetcher.data;

    if (data.ok && data.intent === "previewPolicy") {
      setPolicyPreview(data.preview);
      if (data.preview.exceeded && !exceptionAuthorized) {
        pendingSubmitRef.current = false;
        setShowExceptionModal(true);
        return;
      }
      // Política OK (o ya justificada): encadena el submit real si estaba pendiente.
      if (pendingSubmitRef.current) {
        pendingSubmitRef.current = false;
        doSubmit();
      }
      return;
    }

    if (data.ok && data.intent === "submit") {
      setCompletedConcepto(concepto);
      setCompletedReceiptId(data.receiptId);
      setCompletedInternational(data.isInternational);
      setUploadSuccess(true);
      return;
    }

    if (!data.ok) {
      pendingSubmitRef.current = false;
      showAppAlert(data.error, { variant: "error" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.state, fetcher.data]);

  const onXmlFileChange = (file: File | null) => {
    setXmlFile(file);
    if (!file || isInternational) return;
    void (async () => {
      try {
        const text = await file.text();
        const total = extractCfdiTotalFromXml(text);
        if (total != null) setMonto(total.toFixed(2));
      } catch {
        /* XML no legible: el usuario sigue pudiendo escribir el monto a mano */
      }
    })();
  };

  function getValidationErrors(): string[] {
    const errors: string[] = [];
    if (!concepto) errors.push("El concepto es obligatorio.");
    if (!monto) errors.push("El monto gastado es obligatorio.");
    else if (isNaN(parseFloat(monto))) errors.push("El monto gastado debe ser un número válido.");
    if (!pdfFile) {
      errors.push(
        isInternational
          ? "Debes adjuntar el comprobante en JPG o PNG."
          : "Debes adjuntar el comprobante en PDF.",
      );
    }
    if (!isInternational && !xmlFile) errors.push("Debes adjuntar el archivo XML.");
    return errors;
  }

  /** Envía el multipart real (crear receipt → subir → registrar) a la action. */
  function doSubmit() {
    if (!pdfFile) return;
    const fd = new FormData();
    fd.set("intent", "submit");
    fd.set("concepto", concepto);
    fd.set("monto", String(parseFloat(monto)));
    fd.set("isInternational", String(isInternational));
    fd.set("intlCurrency", intlCurrency);
    fd.set("fechaComprobante", fechaComprobante);
    if (resubmit && receiptToReplace) fd.set("receiptToReplace", receiptToReplace);
    fd.set("pdf", pdfFile);
    if (!isInternational && xmlFile) fd.set("xml", xmlFile);
    fetcher.submit(fd, { method: "post", encType: "multipart/form-data" });
  }

  const handleSubmit = () => {
    setShowValidation(true);

    const errors = getValidationErrors();
    if (errors.length > 0) {
      showAppAlert(errors.join(" "), { variant: "warning" });
      return;
    }

    if (isInternational) {
      const emisionIntl = new Date(`${fechaComprobante.trim()}T12:00:00`);
      if (!fechaComprobante.trim() || Number.isNaN(emisionIntl.getTime())) {
        showAppAlert(
          "La fecha del comprobante no es válida. Elige una fecha en el calendario.",
          { variant: "warning" },
        );
        return;
      }
    }

    // Si ya se justificó la excepción, salta el preview y envía directo.
    if (exceptionAuthorized) {
      doSubmit();
      return;
    }

    // Preview de política primero; el submit real se encadena en el efecto.
    pendingSubmitRef.current = true;
    const fd = new FormData();
    fd.set("intent", "previewPolicy");
    fd.set("concepto", concepto);
    fd.set("monto", String(parseFloat(monto)));
    fd.set("currency", isInternational ? intlCurrency : "MXN");
    fetcher.submit(fd, { method: "post" });
  };

  if (uploadSuccess) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] bg-[var(--color-surface-secondary)] p-6">
        <UploadSuccessCard
          requestId={requestId}
          receiptId={completedReceiptId ?? 0}
          concepto={completedConcepto}
          apiBaseUrl="/api"
          uploadResult={null}
          registroResponse={null}
          registroError={null}
          isInternational={completedInternational}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Form fields ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label
            htmlFor="concepto"
            className="block text-sm font-medium mb-1.5 text-[var(--color-ink-secondary)]"
          >
            Concepto
          </label>
          <select
            id="concepto"
            name="concepto"
            className="w-full border border-[var(--color-neutral-300)] rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors"
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
          >
            {CONCEPTO_OPTIONS.map((opt) => (
              <option key={opt}>{opt}</option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="monto"
            className="block text-sm font-medium mb-1.5 text-[var(--color-ink-secondary)]"
          >
            Monto
          </label>
          <input
            id="monto"
            type="number"
            step="0.01"
            className={`${
              showValidation && (!monto || isNaN(parseFloat(monto)))
                ? "w-full border border-accent-400 rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] placeholder:text-[var(--color-ink-subtle)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors"
                : "w-full border border-[var(--color-neutral-300)] rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] placeholder:text-[var(--color-ink-subtle)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors"
            }`}
            placeholder="Ej. 443.50"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            required
          />
        </div>
      </div>

      {/* ── International toggle ── */}
      <label className="flex items-center gap-2 text-sm text-[var(--color-ink-secondary)] cursor-pointer">
        <input
          type="checkbox"
          checked={isInternational}
          onChange={(e) => setIsInternational(e.target.checked)}
          className="accent-primary-400"
        />
        Es en moneda extranjera
      </label>

      {isInternational && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="intlCurrency"
              className="block text-sm font-medium mb-1.5 text-[var(--color-ink-secondary)]"
            >
              Moneda del recibo
            </label>
            <select
              id="intlCurrency"
              className="w-full border border-[var(--color-neutral-300)] rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)]"
              value={intlCurrency}
              onChange={(e) => setIntlCurrency(e.target.value as IntlCurrency)}
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="JPY">JPY</option>
              <option value="CAD">CAD</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="fechaComprobante"
              className="block text-sm font-medium mb-1.5 text-[var(--color-ink-secondary)]"
            >
              Fecha del gasto
            </label>
            <input
              id="fechaComprobante"
              type="date"
              className="w-full border border-[var(--color-neutral-300)] rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)]"
              value={fechaComprobante}
              onChange={(e) => setFechaComprobante(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* ── Drag & drop file zone (modo selección, sin subida directa) ── */}
      <FileDropZone
        isInternational={isInternational}
        onPdfChange={setPdfFile}
        onXmlChange={onXmlFileChange}
        className={showValidation ? "show-missing" : ""}
      />

      {/* M2-006 RF-44 — Alerta de política. Solo visible cuando hay preview que excedió. */}
      {policyPreview && (
        <PolicyAlert
          exceeded={policyPreview.exceeded && !exceptionAuthorized}
          capAmount={policyPreview.capAmount}
          capUnit={policyPreview.capUnit}
          currency={policyPreview.currency}
          message={policyPreview.message}
          onJustify={() => setShowExceptionModal(true)}
        />
      )}

      {/* ── Actions ── */}
      <div className="flex justify-end gap-4 pt-4">
        <a href={`/comprobar-solicitud/${requestId}`}>
          <Button type="button" variant="border" color="danger">
            Cancelar
          </Button>
        </a>
        <ModalWrapper
          title="Subir comprobación"
          message="¿Está seguro de que desea subir este Comprobante?"
          modal_type="confirm"
          button_type="primary"
          variant="filled"
          disabled={submitting}
          onConfirm={handleSubmit}
        >
          Subir Comprobante
        </ModalWrapper>
      </div>

      {policyPreview && (
        <PolicyExceptionModal
          open={showExceptionModal}
          onClose={() => setShowExceptionModal(false)}
          requestId={requestId}
          policyId={policyPreview.policyId}
          capId={policyPreview.capId}
          amountClaimed={parseFloat(monto) || 0}
          excessAmount={policyPreview.excessTotal}
          onCreated={() => {
            setExceptionAuthorized(true);
            showAppAlert(
              "Justificación enviada. Vuelve a presionar 'Subir Comprobante' para completar el registro.",
              { variant: "info" },
            );
          }}
        />
      )}

      {showDevPanel && (
        <p className="text-xs text-[var(--color-ink-muted)]">
          Modo dev: el registro CFDI y la validación SAT corren en el servidor (action RR7).
        </p>
      )}
    </div>
  );
}
