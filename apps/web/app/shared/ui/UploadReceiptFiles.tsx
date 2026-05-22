/**
 * @module UploadReceiptFiles
 * @description Componente "fire-and-forget" para subir archivos de
 * comprobante asociados a una solicitud. Histórico: se invocaba con
 * `pdfFile` / `xmlFile` ya escogidos por el usuario y disparaba un `fetch`
 * a `/api/files/upload-receipt-files/:id` cuando cambiaban.
 *
 * Las rutas `subir-comprobante.$id` / `resubir-comprobante.$id` lo
 * renderizan pasando únicamente `requestId` (y opcionalmente `resubmit`);
 * los archivos se eligen dentro del componente vía un `<input type="file">`
 * y se envían al endpoint Swagger M1 público — ese endpoint es **kept**
 * (no se retira) en el contrato `apps/web/app/routes/api/README.md`.
 */
import { useState } from "react";

const API_BASE_URL =
  (typeof window !== "undefined"
    ? (window as unknown as { __API_BASE__?: string }).__API_BASE__
    : undefined) ??
  (typeof process !== "undefined" ? process.env.PUBLIC_API_BASE_URL : undefined) ??
  "https://localhost:3000/api";

interface Props {
  requestId: number;
  resubmit?: boolean;
  /** Optional: ID del receipt a reemplazar (modo resubmit). */
  receiptToReplace?: string | null;
}

export default function UploadReceiptFiles({
  requestId,
  resubmit = false,
  receiptToReplace = null,
}: Props) {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  async function upload() {
    if (!pdfFile && !xmlFile) {
      setStatus({ type: "error", message: "Adjunta al menos un archivo PDF o XML." });
      return;
    }
    setUploading(true);
    setStatus(null);
    try {
      const formData = new FormData();
      if (pdfFile) formData.append("pdf", pdfFile);
      if (xmlFile) formData.append("xml", xmlFile);

      const response = await fetch(
        `${API_BASE_URL}/files/upload-receipt-files/${requestId}`,
        {
          method: "POST",
          body: formData,
          credentials: "include",
        },
      );
      if (!response.ok) {
        throw new Error("Error al subir los archivos");
      }

      if (resubmit && receiptToReplace) {
        try {
          await fetch(
            `${API_BASE_URL}/applicant/delete-receipt/${receiptToReplace}`,
            { method: "DELETE", credentials: "include" },
          );
        } catch (delErr) {
          console.error("Error eliminando comprobante anterior:", delErr);
        }
      }

      setStatus({
        type: "success",
        message: resubmit
          ? "Comprobante reemplazado correctamente."
          : "Archivos subidos correctamente.",
      });
    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Error desconocido al subir los archivos.",
      });
    } finally {
      setUploading(false);
    }
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
            type="file"
            accept=".xml,text/xml,application/xml"
            onChange={(e) => setXmlFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-[var(--color-ink-muted)]"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => void upload()}
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
