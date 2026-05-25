/**
 * @module ReceiptItem
 * @description Wrapper React que combina `ReceiptDetailCard` (presentational)
 * con `ReceiptActions` (Aprobar/Rechazar). Mantiene `validation` localmente
 * para reflejar el cambio post-submit sin esperar al re-loader (que igual
 * dispara `useFetcher` automáticamente).
 */

import { useState } from "react";
import ReceiptDetailCard, { type ReceiptDetailProps } from "~/shared/ui/ReceiptDetailCard";
import ReceiptActions from "~/shared/ui/ReceiptActions";

interface ReceiptItemProps extends Omit<ReceiptDetailProps, "children"> {
  requestId: number;
  receiptTypeName: string;
}

export default function ReceiptItem({
  receiptId,
  requestId,
  receiptTypeName,
  ...cardProps
}: ReceiptItemProps) {
  const [currentValidation, setCurrentValidation] = useState(cardProps.validation);

  const handleApproveSuccess = () => setCurrentValidation("Aprobado");
  const handleRejectSuccess = () => setCurrentValidation("Rechazado");

  const isReviewable = currentValidation === "Pendiente";

  return (
    <ReceiptDetailCard
      {...cardProps}
      validation={currentValidation}
      receiptId={receiptId}
      receiptTypeName={receiptTypeName}
    >
      {isReviewable && (
        <div className="mt-3 ml-10 flex items-center gap-3">
          <ReceiptActions
            receipt_id={receiptId}
            request_id={requestId}
            receipt_type_name={receiptTypeName}
            onApprove={handleApproveSuccess}
            onReject={handleRejectSuccess}
          />
        </div>
      )}
    </ReceiptDetailCard>
  );
}
