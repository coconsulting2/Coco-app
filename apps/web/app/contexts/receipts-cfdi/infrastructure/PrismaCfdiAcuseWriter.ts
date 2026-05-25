/**
 * @module PrismaCfdiAcuseWriter
 * @description Adapter para el port `CfdiAcuseWriter`. Convierte el
 * `CfdiValidationResult` (shape del port `CfdiValidator`) al row snake_case
 * que `ComprobantesModel.updateSatAcuseByReceiptId` espera.
 *
 * Nota: replicamos localmente el mapeo de `@coco/integrations/sat.acuseToCfdiRow`
 * porque esa utility opera sobre `ConsultaResult` (que incluye `raw` con la
 * respuesta SOAP) y el port abstracto solo expone los campos normalizados.
 */
import ComprobantesModel from "~/contexts/receipts-cfdi/infrastructure/comprobantesModel.js";
import type { CfdiAcuseWriter } from "~/contexts/receipts-cfdi/domain/ports/CfdiAcuseWriter.js";
import type { CfdiValidationResult } from "~/contexts/receipts-cfdi/domain/ports/CfdiValidator.js";

type CfdiAcuseRow = {
  sat_codigo_estatus: string;
  sat_estado: string;
  sat_es_cancelable: string | null;
  sat_estatus_cancelacion: string | null;
  sat_validacion_efos: string;
};

function acuseToRow(acuse: CfdiValidationResult): CfdiAcuseRow {
  return {
    sat_codigo_estatus: acuse.codigoEstatus,
    sat_estado: acuse.estado,
    sat_es_cancelable: acuse.esCancelable || null,
    sat_estatus_cancelacion: acuse.estatusCancelacion || null,
    sat_validacion_efos: acuse.validacionEFOS || "200",
  };
}

export class PrismaCfdiAcuseWriter implements CfdiAcuseWriter {
  async updateAcuseByReceiptId(receiptId: number, acuse: CfdiValidationResult): Promise<void> {
    const row = acuseToRow(acuse);
    await ComprobantesModel.updateSatAcuseByReceiptId(receiptId, row);
  }
}
