/**
 * AccountingExportPanel — Exportación contable para ERP (M1-010).
 *
 * Prop-driven: recibe `data` del loader de `routes/_app/exportar-contable.tsx`
 * (pólizas en formato SAP: header + detalle con SHKZG, AMT_DOCCUR, GL_ACCOUNT…)
 * y las normaliza a la forma de presentación. El filtro de rango usa
 * `<Form method="get">` (loader-driven, RR7). La descarga JSON usa `useFetcher`
 * contra la `action` de la ruta. Sin `apiRequest`/`fetch('/api/...')`/`token`.
 */

import { useEffect, useRef, useState, type SVGProps } from "react";
import { Form, useFetcher, useNavigation } from "react-router";
import Button from "~/shared/ui/Button";
import Toast from "~/shared/ui/Toast";
import type { AccountingPoliza } from "~/contexts/accounts-payable";
import type {
  ExportarContableActionData,
  ExportarContableLoaderData,
} from "~/routes/_app/exportar-contable";

interface PolizaHeader {
  ID_VIAJE?: string;
  DOC_TYPE?: string;
  HEADER_TXT?: string;
  PSTNG_DATE?: string;
  CURRENCY?: string;
  COMP_CODE?: string;
  [key: string]: unknown;
}

interface Poliza {
  requestId?: number;
  docType?: string;
  polizaIndex?: number;
  header?: PolizaHeader;
  detalle?: Record<string, unknown>[];
  detalles?: PolizaDetalle[];
  [key: string]: unknown;
}

interface PolizaDetalle {
  glAccount?: string;
  glAccountName?: string;
  indicatorDebitCredit?: string;
  amountDocCurrency?: number;
  currency?: string;
  taxCode?: string;
  costCenter?: string;
  assignment?: string;
  itemText?: string;
}

/* ── Iconos SVG (currentColor); no dependen de la fuente Material Icons ── */

function IconSearch({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" {...rest}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

function IconDownload({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" {...rest}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
}

function IconAlertCircle({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" {...rest}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function IconArchive({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" {...rest}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
      />
    </svg>
  );
}

function IconChevronDown({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" {...rest}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function IconChevronUp({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" {...rest}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  );
}

function IconJson({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" {...rest}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
      />
    </svg>
  );
}

function formatMoney(value: number | undefined, currency = "MXN"): string {
  if (value == null || Number.isNaN(value)) return "—";
  try {
    return value.toLocaleString("es-MX", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    });
  } catch {
    return `${value.toLocaleString("es-MX", { minimumFractionDigits: 2 })} ${currency}`;
  }
}

function sharedDocCurrency(detalles: PolizaDetalle[]): string | undefined {
  const codes = detalles
    .map((d) => (typeof d.currency === "string" && d.currency.trim() ? d.currency.trim() : null))
    .filter((c): c is string => Boolean(c));
  if (codes.length === 0) return "MXN";
  const uniq = [...new Set(codes)];
  return uniq.length === 1 ? uniq[0] : undefined;
}

function formatTotalAmount(value: number, detalles: PolizaDetalle[]): string {
  const shared = sharedDocCurrency(detalles);
  if (shared) return formatMoney(value, shared);
  return `${value.toLocaleString("es-MX", { minimumFractionDigits: 2 })} (varias monedas)`;
}

/** Convierte una línea SAP / mixta al modelo que usa la tabla. */
function mapDetalleLine(line: Record<string, unknown>, headerCurrency: string): PolizaDetalle {
  const shkzg = String(line.SHKZG ?? line.indicatorDebitCredit ?? "").trim();
  const amtRaw = line.AMT_DOCCUR ?? line.amountDocCurrency;
  const amt = typeof amtRaw === "number" ? amtRaw : Number(amtRaw);
  return {
    glAccount: String(line.GL_ACCOUNT ?? line.glAccount ?? "").trim() || undefined,
    glAccountName:
      typeof line.glAccountName === "string" && line.glAccountName.trim()
        ? line.glAccountName.trim()
        : undefined,
    indicatorDebitCredit: shkzg === "S" || shkzg === "H" ? shkzg : undefined,
    amountDocCurrency: Number.isFinite(amt) ? amt : 0,
    currency:
      String(line.CURRENCY ?? line.currency ?? (headerCurrency || "MXN")).trim() || "MXN",
    costCenter: (() => {
      const s = String(line.COSTCENTER ?? line.costCenter ?? "").trim();
      return s || undefined;
    })(),
    itemText: (() => {
      const s = String(line.ITEM_TEXT ?? line.itemText ?? "").trim();
      return s || undefined;
    })(),
  };
}

/** Une la póliza SAP (header + detalle) con campos útiles para UI y descarga. */
function enrichPolizaForUi(p: AccountingPoliza, listIndex: number): Poliza {
  const header = (p.header ?? {}) as PolizaHeader;
  const headerCurrency = typeof header.CURRENCY === "string" ? header.CURRENCY : "MXN";
  const rawLines = Array.isArray(p.detalle) ? p.detalle : [];
  const lines = rawLines.map((row) =>
    mapDetalleLine(row as unknown as Record<string, unknown>, headerCurrency),
  );

  const idStr = header.ID_VIAJE != null ? String(header.ID_VIAJE).trim() : "";
  let requestId: number | undefined;
  if (idStr !== "" && !Number.isNaN(Number(idStr))) {
    requestId = Number(idStr);
  }

  const docType = String(header.DOC_TYPE ?? "").trim() || "—";

  return {
    header,
    detalle: rawLines as unknown as Record<string, unknown>[],
    requestId,
    docType,
    polizaIndex: listIndex,
    detalles: lines,
  };
}

export default function AccountingExportPanel({ data }: { data: ExportarContableLoaderData }) {
  const navigation = useNavigation();
  const downloadFetcher = useFetcher<ExportarContableActionData>();

  const polizas: AccountingPoliza[] = data.ok ? data.result.polizas : [];
  const from = data.ok ? data.result.from : data.from;
  const to = data.ok ? data.result.to : data.to;
  const includeSynced = data.force;
  const loaderError = data.ok ? null : data.error;

  const uiPolizas = polizas.map((p, i) => enrichPolizaForUi(p, i));

  const isQuerying = navigation.state !== "idle" && navigation.formMethod == null;
  const isDownloading = downloadFetcher.state !== "idle";

  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info" | "warning";
    id: number;
  } | null>(null);
  const toastIdRef = useRef(0);

  // Toast tras una descarga JSON resuelta vía fetcher.
  const lastHandledDownload = useRef<ExportarContableActionData | null>(null);
  useEffect(() => {
    const result = downloadFetcher.data;
    if (!result || downloadFetcher.state !== "idle") return;
    if (lastHandledDownload.current === result) return;
    lastHandledDownload.current = result;

    if (result.ok) {
      const blob = new Blob([result.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toastIdRef.current += 1;
      setToast({ message: "Archivo JSON descargado.", type: "success", id: toastIdRef.current });
    } else {
      toastIdRef.current += 1;
      setToast({ message: `Error: ${result.error}`, type: "error", id: toastIdRef.current });
    }
  }, [downloadFetcher.data, downloadFetcher.state]);

  const toggleExpand = (idx: number) => {
    setExpandedIdx((prev) => (prev === idx ? null : idx));
  };

  return (
    <div className="w-full min-w-0 max-w-full space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} key={toast.id} />}

      <Form
        method="get"
        className="rounded-[var(--radius-lg)] border border-[var(--color-neutral-200)] bg-[var(--color-surface-white)] p-4 sm:p-5 shadow-[var(--shadow-sm)]"
        aria-label="Filtros de exportación"
      >
        <p className="eyebrow mb-4">Rango de fechas</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4 lg:grid-cols-12 lg:items-end lg:gap-x-4">
          <div className="min-w-0 sm:col-span-1 lg:col-span-2">
            <label
              htmlFor="export-date-from"
              className="mb-1 block text-xs text-[var(--color-ink-muted)]"
            >
              Desde
            </label>
            <input
              id="export-date-from"
              name="date_from"
              type="date"
              defaultValue={from}
              required
              className="w-full min-w-0 border border-[var(--color-neutral-300)] rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
            />
          </div>
          <div className="min-w-0 sm:col-span-1 lg:col-span-2">
            <label
              htmlFor="export-date-to"
              className="mb-1 block text-xs text-[var(--color-ink-muted)]"
            >
              Hasta
            </label>
            <input
              id="export-date-to"
              name="date_to"
              type="date"
              defaultValue={to}
              className="w-full min-w-0 border border-[var(--color-neutral-300)] rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
            />
          </div>

          <div className="flex min-h-[44px] min-w-0 items-center gap-3 sm:col-span-2 lg:col-span-5">
            <input
              id="export-include-synced"
              name="status"
              type="checkbox"
              value="Sincronizado"
              defaultChecked={includeSynced}
              className="size-5 shrink-0 cursor-pointer rounded border-[var(--color-neutral-300)] text-primary-500 focus:ring-2 focus:ring-primary-200 focus:ring-offset-0"
            />
            <label
              htmlFor="export-include-synced"
              className="min-w-0 cursor-pointer text-base font-medium leading-snug text-[var(--color-ink-secondary)]"
            >
              Incluir ya sincronizados
            </label>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-3 lg:justify-end">
            <Button type="submit" variant="filled" color="primary" size="big" disabled={isQuerying}>
              {isQuerying ? (
                <span className="inline-flex items-center justify-center gap-2.5">
                  <span
                    className="inline-block size-5 shrink-0 border-2 border-white border-t-transparent rounded-full animate-spin"
                    aria-hidden
                  />
                  <span className="text-base leading-none">Consultando…</span>
                </span>
              ) : (
                <span className="inline-flex items-center justify-center gap-2.5">
                  <IconSearch className="size-5 shrink-0 opacity-95" aria-hidden />
                  <span className="text-base leading-none font-semibold">Consultar</span>
                </span>
              )}
            </Button>
          </div>
        </div>
      </Form>

      {uiPolizas.length > 0 && (
        <downloadFetcher.Form method="post" className="flex justify-end">
          <input type="hidden" name="_csrf" value={data.csrfToken} />
          <input type="hidden" name="intent" value="download-json" />
          <input type="hidden" name="date_from" value={from} />
          <input type="hidden" name="date_to" value={to} />
          {includeSynced && <input type="hidden" name="status" value="Sincronizado" />}
          <Button type="submit" variant="border" color="primary" size="big" disabled={isDownloading}>
            <span className="inline-flex items-center justify-center gap-2.5">
              <IconDownload className="size-5 shrink-0" aria-hidden />
              <span className="text-base leading-none font-semibold">
                {isDownloading ? "Generando…" : "Descargar JSON"}
              </span>
            </span>
          </Button>
        </downloadFetcher.Form>
      )}

      {loaderError && (
        <div className="rounded-[var(--radius-md)] border border-accent-400 bg-accent-50 p-4 text-sm text-accent-500 flex items-start gap-2.5">
          <IconAlertCircle className="size-5 shrink-0 mt-0.5 text-accent-500" aria-hidden />
          <span>{loaderError}</span>
        </div>
      )}

      {!loaderError && uiPolizas.length === 0 && (
        <div
          role="status"
          className="block w-full min-w-0 rounded-[var(--radius-lg)] border border-[var(--color-neutral-200)] bg-[var(--color-surface-white)] px-4 py-8 sm:px-8 sm:py-10"
        >
          <IconArchive
            className="mx-auto mb-4 block size-14 shrink-0 text-[var(--color-neutral-300)]"
            aria-hidden
          />
          <p className="w-full min-w-0 whitespace-normal break-words text-left text-base leading-relaxed text-[var(--color-ink-muted)]">
            <span className="font-medium text-[var(--color-ink-secondary)]">
              No hay pólizas pendientes de exportar en este rango.
            </span>{" "}
            Activa &quot;Incluir ya sincronizados&quot; para ver lotes previamente exportados, o amplía las
            fechas (el filtro usa la fecha de validación del comprobante aprobado).
          </p>
        </div>
      )}

      {uiPolizas.length > 0 && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Pólizas" value={String(uiPolizas.length)} detail={`${from} → ${to}`} />
            <KpiCard
              label="Solicitudes"
              value={String(
                new Set(uiPolizas.map((p) => p.requestId).filter((id) => id != null)).size,
              )}
              detail="Viajes distintos"
            />
            <KpiCard
              label="Líneas totales"
              value={String(uiPolizas.reduce((sum, p) => sum + (p.detalles?.length ?? 0), 0))}
              detail="Partidas contables"
            />
            <KpiCard label="Estado" value="Listo" detail="Vista alineada al JSON del API" variant="success" />
          </div>

          <section className="space-y-3">
            <p className="eyebrow">Vista previa de pólizas</p>
            {uiPolizas.map((poliza, idx) => (
              <PolizaCard
                key={`${poliza.requestId}-${poliza.polizaIndex}-${idx}`}
                poliza={poliza}
                index={idx}
                isExpanded={expandedIdx === idx}
                onToggle={() => toggleExpand(idx)}
              />
            ))}
          </section>
        </>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  detail,
  variant = "default",
}: {
  label: string;
  value: string;
  detail?: string;
  variant?: "default" | "success" | "warning";
}) {
  const valueColor =
    variant === "success"
      ? "text-success-500"
      : variant === "warning"
        ? "text-warning-500"
        : "text-[var(--color-ink)]";
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-neutral-200)] bg-[var(--color-surface-white)] px-4 py-4 shadow-[var(--shadow-sm)]">
      <p className="eyebrow mb-1">{label}</p>
      <p className={`text-2xl font-light leading-tight tabular-nums ${valueColor}`}>{value}</p>
      {detail && <p className="mt-1.5 text-xs text-[var(--color-ink-muted)] leading-snug">{detail}</p>}
    </div>
  );
}

function PolizaCard({
  poliza,
  index,
  isExpanded,
  onToggle,
}: {
  poliza: Poliza;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const header = (poliza.header ?? {}) as PolizaHeader;
  const detalles = poliza.detalles ?? [];
  const totalDebe = detalles
    .filter((d) => d.indicatorDebitCredit === "S")
    .reduce((sum, d) => sum + (d.amountDocCurrency ?? 0), 0);
  const totalHaber = detalles
    .filter((d) => d.indicatorDebitCredit === "H")
    .reduce((sum, d) => sum + (d.amountDocCurrency ?? 0), 0);

  const viajeLabel =
    poliza.requestId != null ? String(poliza.requestId) : header.ID_VIAJE != null ? String(header.ID_VIAJE) : "—";
  const titulo =
    typeof header.HEADER_TXT === "string" && header.HEADER_TXT.trim()
      ? header.HEADER_TXT.trim()
      : `Póliza ${poliza.docType ?? "—"}`;

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-neutral-200)] bg-[var(--color-surface-white)] overflow-hidden shadow-[var(--shadow-sm)]">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-[var(--color-surface-secondary)] transition-colors cursor-pointer text-left"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-primary-50 text-primary-600 text-xs font-semibold shrink-0 tabular-nums">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[var(--color-ink)] leading-snug">
              Viaje <span className="tabular-nums">#{viajeLabel}</span>
              <span className="text-[var(--color-ink-muted)] font-normal"> · {poliza.docType ?? "—"}</span>
            </p>
            <p className="text-xs text-[var(--color-ink-secondary)] mt-0.5 truncate" title={titulo}>
              {titulo}
            </p>
            <p className="text-xs text-[var(--color-ink-muted)] mt-1">
              {detalles.length} partida{detalles.length !== 1 ? "s" : ""} · Debe{" "}
              {formatTotalAmount(totalDebe, detalles)} · Haber {formatTotalAmount(totalHaber, detalles)}
            </p>
          </div>
        </div>
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-neutral-200)] bg-[var(--color-surface-white)] text-[var(--color-ink-muted)]">
          {isExpanded ? (
            <IconChevronUp className="size-5" aria-hidden />
          ) : (
            <IconChevronDown className="size-5" aria-hidden />
          )}
        </span>
      </button>

      {isExpanded && (
        <div className="border-t border-[var(--color-neutral-200)] bg-[var(--color-surface-secondary)]/40">
          {detalles.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="bg-[var(--color-surface-secondary)] border-b border-[var(--color-neutral-200)]">
                    <th className="text-left px-3 py-2.5 font-medium text-[var(--color-ink-secondary)]">
                      Cuenta
                    </th>
                    <th className="text-left px-3 py-2.5 font-medium text-[var(--color-ink-secondary)]">
                      Nombre
                    </th>
                    <th className="text-center px-3 py-2.5 font-medium text-[var(--color-ink-secondary)] w-24">
                      D/H
                    </th>
                    <th className="text-right px-3 py-2.5 font-medium text-[var(--color-ink-secondary)] whitespace-nowrap">
                      Monto
                    </th>
                    <th className="text-center px-3 py-2.5 font-medium text-[var(--color-ink-secondary)] w-20">
                      Moneda
                    </th>
                    <th className="text-left px-3 py-2.5 font-medium text-[var(--color-ink-secondary)] w-28">
                      CC
                    </th>
                    <th className="text-left px-3 py-2.5 font-medium text-[var(--color-ink-secondary)] min-w-[140px]">
                      Texto
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {detalles.map((d, i) => {
                    const dh = d.indicatorDebitCredit;
                    const dhLabel =
                      dh === "S" ? "Debe" : dh === "H" ? "Haber" : dh ? String(dh) : "—";
                    return (
                      <tr
                        key={i}
                        className="border-b border-[var(--color-neutral-100)] odd:bg-[var(--color-surface-white)] even:bg-[var(--color-surface-secondary)]/50 hover:bg-primary-50/30 transition-colors"
                      >
                        <td className="px-3 py-2.5 tabular-nums font-medium text-[var(--color-ink)]">
                          {d.glAccount ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 text-[var(--color-ink-secondary)] max-w-[200px] truncate">
                          {d.glAccountName ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                              dh === "S"
                                ? "bg-primary-50 text-primary-600"
                                : dh === "H"
                                  ? "bg-accent-50 text-accent-500"
                                  : "bg-[var(--color-neutral-200)] text-[var(--color-ink-muted)]"
                            }`}
                          >
                            {dhLabel}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-medium text-[var(--color-ink)] whitespace-nowrap">
                          {formatMoney(d.amountDocCurrency, d.currency ?? "MXN")}
                        </td>
                        <td className="px-3 py-2.5 text-center text-[var(--color-ink-muted)] tabular-nums">
                          {d.currency ?? "MXN"}
                        </td>
                        <td className="px-3 py-2.5 text-[var(--color-ink-secondary)] tabular-nums">
                          {d.costCenter ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 text-[var(--color-ink-muted)] max-w-[280px] truncate" title={d.itemText}>
                          {d.itemText ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[var(--color-neutral-300)] bg-[var(--color-surface-secondary)]">
                    <td colSpan={2} className="px-3 py-2.5 font-medium text-[var(--color-ink)]">
                      Totales
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-primary-50 text-primary-600">
                        Debe
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-[var(--color-ink)]">
                      {formatTotalAmount(totalDebe, detalles)}
                    </td>
                    <td colSpan={3} />
                  </tr>
                  <tr className="bg-[var(--color-surface-secondary)] border-b border-[var(--color-neutral-200)]">
                    <td colSpan={2} className="px-3 py-2.5" />
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-accent-50 text-accent-500">
                        Haber
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-[var(--color-ink)]">
                      {formatTotalAmount(totalHaber, detalles)}
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="p-4 text-sm text-[var(--color-ink-muted)]">Póliza sin partidas de detalle.</p>
          )}

          <details className="border-t border-[var(--color-neutral-200)] bg-[var(--color-surface-white)]">
            <summary className="px-4 py-2.5 text-xs text-[var(--color-ink-muted)] cursor-pointer hover:bg-[var(--color-surface-secondary)] transition-colors select-none font-medium inline-flex items-center gap-2 w-full list-none [&::-webkit-details-marker]:hidden">
              <IconJson className="size-4 shrink-0 text-[var(--color-ink-muted)]" aria-hidden />
              Ver JSON crudo (SAP)
            </summary>
            <pre className="px-4 py-3 text-[11px] leading-relaxed text-[var(--color-ink-secondary)] bg-[var(--color-surface-secondary)] overflow-x-auto max-h-[280px] border-t border-[var(--color-neutral-100)]">
              {JSON.stringify({ header: poliza.header, detalle: poliza.detalle }, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
