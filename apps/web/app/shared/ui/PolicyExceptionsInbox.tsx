/**
 * PolicyExceptionsInbox — bandeja para que aprobadores N1/N2 resuelvan
 * excepciones de política (M2-006 RF-45). Lista PENDING y permite aprobar /
 * rechazar con nota.
 *
 * Prop-driven: recibe `exceptions` del loader de la ruta anfitriona. Las
 * decisiones se envían vía `useFetcher` con intent `policy-exception:decide`
 * a la `action` de la ruta (prop opcional `action`). Sin
 * `apiRequest`/`fetch('/api/...')`/`token`. El loader/action debe manejar el
 * intent vía el use-case `decideException` del slice policies.
 */
import { useEffect, useState } from "react";
import { useFetcher, useRevalidator } from "react-router";
import Button from "~/shared/ui/Button";
import Toast from "~/shared/ui/Toast";
import Modal from "~/shared/ui/Modal";

export interface PolicyExceptionRow {
  exceptionId: number;
  requestId: number;
  receiptId: number | null;
  amountClaimed: string | number;
  excessAmount: string | number;
  justification: string;
  status: string;
  createdAt?: string;
  receipt?: { receiptId: number; amount: string | number; receiptType?: { receiptTypeName: string } } | null;
  request?: { requestId: number; userId: number | null };
}

export interface PolicyExceptionsInboxProps {
  exceptions: PolicyExceptionRow[];
  /** Token CSRF emitido por el loader de la ruta anfitriona (double-submit). */
  csrfToken?: string;
  /** Ruta destino del submit; por defecto la ruta actual (action del route). */
  action?: string;
}

type DecideResult = { ok: true } | { ok: false; error: string };

const formatMxn = (n: number, currency = "MXN") =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(n);

export default function PolicyExceptionsInbox({ exceptions, csrfToken, action }: PolicyExceptionsInboxProps) {
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [decisionFor, setDecisionFor] = useState<{ id: number; decision: "APPROVED" | "REJECTED" } | null>(null);
  const [note, setNote] = useState("");

  const fetcher = useFetcher<DecideResult>();
  const revalidator = useRevalidator();
  const busy = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok) {
      setToast({ message: "Excepción resuelta.", type: "success" });
      setDecisionFor(null);
      setNote("");
      // Recarga los datos del loader anfitrión para que la fila decidida
      // desaparezca de la lista (regla del proyecto: refresco con
      // useRevalidator, sin refetch a /api).
      revalidator.revalidate();
    } else {
      setToast({ message: fetcher.data.error, type: "error" });
    }
  }, [fetcher.state, fetcher.data, revalidator]);

  function decide() {
    if (!decisionFor) return;
    const fd = new FormData();
    fd.set("intent", "policy-exception:decide");
    fd.set("_csrf", csrfToken ?? "");
    fd.set("exceptionId", String(decisionFor.id));
    fd.set("decision", decisionFor.decision);
    fd.set("decisionNote", note || "");
    fetcher.submit(fd, action ? { method: "post", action } : { method: "post" });
  }

  return (
    <section style={{ marginTop: "2rem" }}>
      <h2 style={{ marginBottom: "0.75rem" }}>Excepciones de política pendientes</h2>
      {exceptions.length === 0 ? (
        <p style={{ color: "var(--color-ink-muted, #6B7280)" }}>No hay excepciones pendientes.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Solicitud</th>
              <th style={th}>Receipt</th>
              <th style={th}>Monto / Exceso</th>
              <th style={th}>Justificación</th>
              <th style={th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {exceptions.map((ex) => (
              <tr key={ex.exceptionId}>
                <td style={td}>#{ex.requestId}</td>
                <td style={td}>
                  {ex.receipt?.receiptType?.receiptTypeName || "—"} (#{ex.receiptId ?? "—"})
                </td>
                <td style={td}>
                  {formatMxn(Number(ex.amountClaimed))}
                  <br />
                  <small style={{ color: "#B91C1C" }}>+{formatMxn(Number(ex.excessAmount))}</small>
                </td>
                <td style={td} title={ex.justification}>
                  {ex.justification.length > 80 ? ex.justification.slice(0, 80) + "…" : ex.justification}
                </td>
                <td style={td}>
                  <Button variant="filled" color="primary" size="small" onClick={() => setDecisionFor({ id: ex.exceptionId, decision: "APPROVED" })}>
                    Aprobar
                  </Button>{" "}
                  <Button variant="border" color="accent" size="small" onClick={() => setDecisionFor({ id: ex.exceptionId, decision: "REJECTED" })}>
                    Rechazar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {decisionFor && (
        <Modal
          title={decisionFor.decision === "APPROVED" ? "Aprobar excepción" : "Rechazar excepción"}
          message={`¿Confirmar ${decisionFor.decision === "APPROVED" ? "aprobación" : "rechazo"} de la excepción #${decisionFor.id}?`}
          show={true}
          onClose={() => setDecisionFor(null)}
        >
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <p>
              ¿Confirmar {decisionFor.decision === "APPROVED" ? "aprobación" : "rechazo"} de la excepción #{decisionFor.id}?
              {decisionFor.decision === "APPROVED"
                ? " El receipt quedará marcado como reembolsable."
                : " El receipt no será reembolsado."}
            </p>
            <label>
              Nota (opcional)
              <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <Button variant="border" color="primary" onClick={() => setDecisionFor(null)}>Cancelar</Button>
              <Button variant="filled" color={decisionFor.decision === "APPROVED" ? "primary" : "accent"} onClick={decide} disabled={busy}>
                {busy ? "Enviando…" : "Confirmar"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </section>
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #ddd" };
const td: React.CSSProperties = { padding: "0.5rem", borderBottom: "1px solid #eee", verticalAlign: "top" };
