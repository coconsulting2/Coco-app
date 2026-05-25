/**
 * @module ReceiptActions
 * @description Botones lado a lado Aprobar/Rechazar para UN receipt.
 * Los modales internos submitean al action de la route padre vía
 * `useFetcher` — no requiere token ni callbacks (la revalidación del loader
 * es automática post-submit).
 */
import AproveReceipStatus from "~/shared/ui/AproveReceiptsModal";
import RejectReceipStatus from "~/shared/ui/RejectReceiptsModal";

interface ReceiptProps {
  receipt_id: number;
  request_id: number;
  receipt_type_name?: string;
  disabled?: boolean;
  onApprove?: (id: number) => void;
  onReject?: (id: number) => void;
}

export default function ReceiptActions({
  receipt_id,
  request_id,
  receipt_type_name,
  disabled = false,
  onApprove,
  onReject,
}: ReceiptProps) {
  const handleApproveSuccess = () => onApprove?.(receipt_id);
  const handleRejectSuccess = () => onReject?.(receipt_id);

  return (
    <div className="flex flex-row gap-2 items-center justify-center w-full">
      <AproveReceipStatus
        receipt_id={receipt_id}
        title="Aprobar comprobante"
        message="¿Está seguro de que deseas aprobar este comprobante?"
        modal_type="success"
        variant="filled"
        disabled={disabled}
        onSuccess={handleApproveSuccess}
      >
        Aprobar
      </AproveReceipStatus>

      <RejectReceipStatus
        receipt_id={receipt_id}
        request_id={request_id}
        receipt_type_name={receipt_type_name}
        disabled={disabled}
        onSuccess={handleRejectSuccess}
      >
        Rechazar
      </RejectReceipStatus>
    </div>
  );
}
