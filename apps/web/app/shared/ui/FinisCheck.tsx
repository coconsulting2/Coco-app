/**
 * @module FinisCheck (FinishRequestButton)
 * @description Botón CxP "Terminar — listo para pago". Migrado a React Router 7:
 * cero `apiRequest`, cero `token`, cero `window.location`. Submitea al action
 * de la route padre vía `useFetcher` con `intent="finalize"`; esa action debe
 * llamar al use-case `validateReceiptsAndUpdateStatus` del slice
 * accounts-payable y, si procede, redirigir. Paridad 1:1 con el legacy
 * `PUT /accounts-payable/validate-receipts/:request_id`.
 */
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import Button from "~/shared/ui/Button";
import Modal from "~/shared/ui/Modal";
import ExpenseSettlementSummary from "~/shared/ui/ExpenseSettlementSummary";
import type { ExpenseSettlement } from "~/shared/utils/expenseSettlement";
import { showAppAlert } from "~/shared/utils/appAlert";

interface Props {
  requestId: number;
  redirectTo?: string;
  settlement: ExpenseSettlement;
}

type FetcherResult = { ok: true; redirect?: string } | { ok: false; error: string };

export default function FinishRequestButton({
  requestId,
  redirectTo = "/dashboard",
  settlement,
}: Props) {
  const fetcher = useFetcher<FetcherResult>();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const submitting = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok) {
      setConfirmOpen(false);
      // El redirect lo maneja RR si la action devuelve `redirect(...)`; si no,
      // mostramos confirmación in-place.
      showAppAlert(
        "Lote marcado como listo para pago. La solicitud quedó finalizada.",
        { variant: "success" },
      );
    } else {
      showAppAlert(fetcher.data.error ?? "Error al finalizar la solicitud.", {
        variant: "error",
      });
    }
  }, [fetcher.state, fetcher.data]);

  const allReviewed = settlement.pendingCount === 0;
  const canFinalize = allReviewed && settlement.approvedCount > 0;

  const finalize = () => {
    const fd = new FormData();
    fd.set("intent", "finalize");
    fd.set("requestId", String(requestId));
    fd.set("redirectTo", redirectTo);
    fetcher.submit(fd, { method: "post" });
  };

  return (
    <>
      <Button
        color="success"
        size="medium"
        disabled={!allReviewed || submitting}
        onClick={() => setConfirmOpen(true)}
      >
        Terminar — listo para pago
      </Button>

      {confirmOpen && (
        <Modal
          title="Resumen final — listo para pago"
          message="Confirma que el cálculo de liquidación es correcto."
          type="confirm"
          onConfirm={canFinalize ? finalize : undefined}
          onClose={() => setConfirmOpen(false)}
          show={confirmOpen}
          confirmLabel="Marcar listo para pago"
        >
          <ExpenseSettlementSummary settlement={settlement} variant="final" />
          {allReviewed && settlement.approvedCount === 0 && (
            <p className="text-sm text-[var(--color-accent-500)] mt-3">
              No hay comprobantes aprobados. Si rechazaste todo el lote, no uses
              Terminar; el solicitante deberá corregir y reenviar.
            </p>
          )}
        </Modal>
      )}
    </>
  );
}
