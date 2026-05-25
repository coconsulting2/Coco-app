/**
 * FileDropZone — Drag & drop zone for PDF and XML receipt files.
 *
 * Modo selección únicamente: valida y almacena los archivos elegidos y los
 * expone vía `onPdfChange` / `onXmlChange`. La subida real ya NO ocurre aquí
 * (regla: `shared/ui` no consume `fetch('/api/...')`); el padre arma un
 * `FormData` multipart y lo envía a la action RR7, que sube a GridFS vía los
 * use-cases del slice receipts-cfdi.
 *
 * Para gastos internacionales (`isInternational=true`) se selecciona una sola
 * imagen JPG/PNG (sin XML).
 *
 * States: idle → dragging → selected → error.
 */

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";

/* ── Types ── */

type DropZoneState = "idle" | "dragging" | "selected" | "error";

/** Resumen fiscal devuelto por el backend tras parsear el XML (GridFS). */
export interface ReceiptUploadCfdiSummary {
  uuid: string;
  version: string;
  rfcEmisor: string;
  rfcReceptor: string | null;
  fecha: string;
  total: number;
  selloUltimos8: string | null;
  taxes: unknown;
}

export interface ReceiptUploadResponse {
  message: string;
  pdf?: { fileId: string; fileName: string };
  xml?: { fileId: string; fileName: string };
  international?: boolean;
  receipt_image?: { fileId: string; fileName: string };
  cfdi?: ReceiptUploadCfdiSummary;
  registro_sugerido?: Record<string, unknown> | null;
}

interface FileDropZoneProps {
  /** If true, XML is optional and only a JPG/PNG image is accepted. */
  isInternational?: boolean;
  /** Called when a PDF/image file is selected/cleared */
  onPdfChange?: (file: File | null) => void;
  /** Called when an XML file is selected/cleared */
  onXmlChange?: (file: File | null) => void;
  className?: string;
  /** When true, show red outlines for missing files (used by parent on submit attempt) */
  showMissingHighlight?: boolean;
}

/* ── Helpers ── */

const ACCEPTED_EXTENSIONS = [".pdf", ".xml"];

const ACCEPT_MAP: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "application/xml": [".xml"],
  "text/xml": [".xml"],
};

const ACCEPT_MAP_INTERNATIONAL: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
};

function getExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx).toLowerCase() : "";
}

function classifyFiles(
  files: File[],
  isInternational: boolean,
): {
  pdf: File | null;
  xml: File | null;
  rejected: string[];
} {
  let pdf: File | null = null;
  let xml: File | null = null;
  const rejected: string[] = [];

  if (isInternational) {
    const imgExt = new Set([".jpg", ".jpeg", ".png"]);
    for (const file of files) {
      const ext = getExtension(file.name);
      if (imgExt.has(ext) && !pdf) {
        pdf = file;
      } else if (!imgExt.has(ext)) {
        rejected.push(file.name);
      }
    }
    return { pdf, xml: null, rejected };
  }

  for (const file of files) {
    const ext = getExtension(file.name);
    if (ext === ".pdf" && !pdf) {
      pdf = file;
    } else if (ext === ".xml" && !xml) {
      xml = file;
    } else if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      rejected.push(file.name);
    }
  }
  return { pdf, xml, rejected };
}

/* ── Component ── */

export default function FileDropZone({
  isInternational = false,
  onPdfChange,
  onXmlChange,
  className = "",
  showMissingHighlight = false,
}: FileDropZoneProps) {
  const [state, setState] = useState<DropZoneState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [xmlFile, setXmlFile] = useState<File | null>(null);

  // Notify parent of file changes
  useEffect(() => {
    onPdfChange?.(pdfFile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfFile]);
  useEffect(() => {
    onXmlChange?.(xmlFile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xmlFile]);

  const reset = useCallback(() => {
    setState("idle");
    setErrorMsg("");
    setPdfFile(null);
    setXmlFile(null);
  }, []);

  const handleDrop = useCallback(
    (acceptedFiles: File[]) => {
      const { pdf, xml, rejected } = classifyFiles(acceptedFiles, isInternational);

      if (rejected.length > 0) {
        setState("error");
        setErrorMsg(
          isInternational
            ? `Extensión no válida: ${rejected.join(", ")}. Solo se aceptan .jpg, .jpeg y .png`
            : `Extensión no válida: ${rejected.join(", ")}. Solo se aceptan .pdf y .xml`,
        );
        return;
      }

      if (!pdf && !xml) {
        setState("error");
        setErrorMsg("No se seleccionaron archivos válidos");
        return;
      }

      // Merge with existing selections
      setPdfFile(pdf ?? pdfFile);
      setXmlFile(xml ?? xmlFile);
      setState("selected");
    },
    [pdfFile, xmlFile, isInternational],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    accept: isInternational ? ACCEPT_MAP_INTERNATIONAL : ACCEPT_MAP,
    maxFiles: isInternational ? 1 : 2,
  });

  const displayState: DropZoneState = isDragActive ? "dragging" : state;

  const needsPdf = !pdfFile;
  const needsXml = !isInternational && !xmlFile;
  const shouldHighlight: boolean =
    Boolean(showMissingHighlight) || Boolean(className && className.includes("show-missing"));

  return (
    <div className={`w-full ${className}`}>
      <div
        {...getRootProps()}
        className={`
          relative flex flex-col items-stretch justify-center gap-3
          border-2 border-dashed rounded-[var(--radius-lg)] p-6
          transition-all duration-200 cursor-pointer min-h-[160px]
          ${stateStyles[displayState]}
          ${shouldHighlight && (needsPdf || needsXml) ? " border-accent-400" : ""}
        `}
        role="button"
        aria-label={
          isInternational
            ? "Zona de carga de imagen del recibo"
            : "Zona de carga de archivos PDF y XML"
        }
      >
        <input {...getInputProps()} />

        {displayState === "idle" && <IdleContent isInternational={isInternational} />}
        {displayState === "dragging" && <DraggingContent />}
        {displayState === "selected" && (
          <SelectedContent
            pdfName={pdfFile?.name ?? null}
            xmlName={xmlFile?.name ?? null}
            needsPdf={needsPdf}
            needsXml={needsXml}
            isInternational={isInternational}
            showMissingHighlight={shouldHighlight}
          />
        )}
        {displayState === "error" && <ErrorContent message={errorMsg} />}
      </div>

      {state === "error" && (
        <button
          onClick={reset}
          className="mt-3 text-sm font-medium text-primary-400 hover:text-primary-500 transition-colors cursor-pointer"
        >
          Intentar de nuevo
        </button>
      )}
    </div>
  );
}

/* ── State-dependent styles ── */

const stateStyles: Record<DropZoneState, string> = {
  idle: "border-[var(--color-neutral-300)] bg-[var(--color-surface-white)] hover:border-primary-300 hover:bg-primary-50/30",
  dragging: "border-primary-400 bg-primary-50/50 scale-[1.01]",
  selected: "border-primary-300 bg-primary-50/20",
  error: "border-accent-300 bg-accent-50/40",
};

/* ── Sub-components for each state ── */

function IdleContent({ isInternational }: { isInternational: boolean }) {
  return (
    <div className="w-full flex flex-col items-center">
      <UploadIcon className="w-8 h-8 text-[var(--color-ink-muted)]" />
      <div className="text-center">
        <p className="text-sm font-medium text-[var(--color-ink-secondary)]">
          Arrastra tus archivos aquí
        </p>
        <p className="text-xs text-[var(--color-ink-muted)] mt-1">
          o haz clic para seleccionar &middot;{" "}
          {isInternational ? (
            <strong>.jpg / .png</strong>
          ) : (
            <>
              <strong>.pdf</strong> y <strong>.xml</strong>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function DraggingContent() {
  return (
    <div className="w-full flex flex-col items-center">
      <UploadIcon className="w-8 h-8 text-primary-400 animate-bounce" />
      <p className="text-sm font-medium text-primary-500">Suelta los archivos aquí</p>
    </div>
  );
}

function SelectedContent({
  pdfName,
  xmlName,
  needsPdf,
  needsXml,
  isInternational,
  showMissingHighlight,
}: {
  pdfName: string | null;
  xmlName: string | null;
  needsPdf: boolean;
  needsXml: boolean;
  isInternational: boolean;
  showMissingHighlight?: boolean;
}) {
  return (
    <div className="w-full max-w-none mx-auto px-0 sm:px-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 items-start">
        <FileChip
          label={isInternational ? "Imagen" : "PDF"}
          fileName={pdfName}
          missing={needsPdf}
          showMissingHighlight={showMissingHighlight}
        />
        {!isInternational && (
          <FileChip
            label="XML"
            fileName={xmlName}
            missing={needsXml}
            showMissingHighlight={showMissingHighlight}
          />
        )}
        {isInternational && !xmlName && (
          <p className="text-xs text-[var(--color-ink-muted)] text-center mt-1 sm:col-span-2">
            Gasto internacional — solo imagen del recibo
          </p>
        )}
      </div>
      {(needsPdf || needsXml) && (
        <p className="text-sm text-[var(--color-ink-muted)] text-center mt-2 leading-relaxed sm:col-span-2 max-w-none">
          Arrastra o haz clic para agregar{needsPdf ? " el PDF" : ""}
          {needsPdf && needsXml ? " y" : ""}
          {needsXml ? " el XML" : ""} faltante
        </p>
      )}
    </div>
  );
}

function FileChip({
  label,
  fileName,
  missing,
  showMissingHighlight,
}: {
  label: string;
  fileName: string | null;
  missing: boolean;
  showMissingHighlight?: boolean;
}) {
  return (
    <div
      className={`w-full grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] border text-sm min-w-0 ${
        missing
          ? showMissingHighlight
            ? "border-dashed border-accent-400 text-accent-500"
            : "border-dashed border-[var(--color-neutral-300)] text-[var(--color-ink-muted)]"
          : "border-success-200 bg-success-50/50 text-success-500"
      }`}
    >
      {missing ? <PlusIcon className="w-4 h-4" /> : <CheckIcon className="w-4 h-4" />}
      <span className="font-medium whitespace-nowrap">{label}:</span>
      <span className="min-w-0 truncate">
        {fileName ?? `Falta archivo .${label.toLowerCase()}`}
      </span>
    </div>
  );
}

function ErrorContent({ message }: { message: string }) {
  return (
    <div className="w-full flex flex-col items-center">
      <ErrorIcon className="w-8 h-8 text-accent-400" />
      <div className="text-center">
        <p className="text-sm font-medium text-accent-500">Error</p>
        <p className="text-xs text-accent-400 mt-1">{message}</p>
      </div>
    </div>
  );
}

/* ── SVG Icons ── */

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
      />
    </svg>
  );
}
