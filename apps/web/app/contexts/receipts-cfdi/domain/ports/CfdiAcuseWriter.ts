/**
 * @module CfdiAcuseWriter
 * @description Puerto para persistir el resultado de una consulta SAT
 * (acuse) en la fila del CFDI asociado al receipt. El adapter encapsula
 * el mapeo `CfdiValidationResult → CfdiRow` (vía `@coco/integrations.sat`).
 */
import type { CfdiValidationResult } from "~/contexts/receipts-cfdi/domain/ports/CfdiValidator.js";

export interface CfdiAcuseWriter {
  updateAcuseByReceiptId(receiptId: number, acuse: CfdiValidationResult): Promise<void>;
}
