/**
 * @module UploadReceiptFiles
 * @description Componente de subida de archivos de comprobante (PDF/XML).
 * Migrado a React Router 7: cero `fetch('/api/...')`, cero `apiRequest`. Los
 * archivos se eligen aquí y se envían como `FormData` multipart vía
 * `useFetcher` con `intent="uploadFiles"` al action de la route padre, que
 * sube a GridFS vía los use-cases del slice receipts-cfdi.
 */
import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

interface Props {
  requestId: number;
  resubmit?: boolean;
  /** ID del receipt a reemplazar (modo resubmit). */
  receiptToReplace?: string | null;
}

type FetcherResult = { ok: true } | { ok: false; error: string };

export default function UploadReceiptFiles({
  requestId,
  resubmit = false,
  receiptToReplace = null,
}: Props) {
  const fetcher = useFetcher<FetcherResult>();
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const xmlRef = useRef<HTMLInputElement>(null);

  const uploading = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok) {
      setStatus({
        type: "success",
        message: resubmit
          ? "Comprobante reemplazado correctamente."
          : "Archivos subidos correctamente.",
      });
    } else {
      setStatus({
        type: "error",
        message: fetcher.data.error ?? "Error desconocido al subir los archivos.",
      });
    }
  }, [fetcher.state, fetcher.data, resubmit]);

  function upload() {
    if (!pdfFile && !xmlFile) {
      setStatus({ type: "error", message: "Adjunta al menos un archivo PDF o XML." });
      return;
    }
    setStatus(null);
    const fd = new FormData();
    fd.set("intent", "uploadFiles");
    fd.set("requestId", String(requestId));
    fd.set("resubmit", String(resubmit));
    if (receiptToReplace) fd.set("receiptToReplace", receiptToReplace);
    if (pdfFile) fd.set("pdf", pdfFile);
    if (xmlFile) fd.set("xml", xmlFile);
    fetcher.submit(fd, { method: "post", encType: "multipart/form-data" });
  }

  return (
    <div className="card-editorial p-6 md:p-8 space-y-4">
      <h2 className="text-lg font-semibold text-[var(--color-ink)]">
        Archivos del comprobante (solicitud #{requestId})
      </h2>
      <p className="text-xs text-[var(--color-ink-secondary)]">
        Sube el PDF y/o XML del comprobante. La validación SAT del CFDI corre
        en el servidor cuando guardas el comprobante.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--color-ink-secondary)] mb-1">
            PDF
          </label>
          <input
            ref={pdfRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-[var(--color-ink-muted)]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-ink-secondary)] mb-1">
            XML
          </label>
          <input
            ref={xmlRef}
            type="file"
            accept=".xml,text/xml,application/xml"
            onChange={(e) => setXmlFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-[var(--color-ink-muted)]"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={upload}
        disabled={uploading}
        className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400"
      >
        {uploading ? "Subiendo…" : resubmit ? "Reemplazar archivos" : "Subir archivos"}
      </button>

      {status ? (
        <p
          className={`text-xs ${
            status.type === "success" ? "text-success-500" : "text-accent-400"
          }`}
        >
          {status.message}
        </p>
      ) : null}
    </div>
  );
}
