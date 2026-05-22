/**
 * @module SatCfdiValidator
 * @description Adapter del puerto `CfdiValidator`. Envuelve
 * `@coco/integrations.sat.consultarCfdiWithRetries` (SOAP + retries con
 * backoff 1s/2s/4s) y mapea al shape del domain.
 */
import { consultarCfdiWithRetries } from "@coco/integrations/sat";
import type {
  CfdiValidationInput,
  CfdiValidationResult,
  CfdiValidator,
} from "~/contexts/receipts-cfdi/domain/ports/CfdiValidator.js";

export class SatCfdiValidator implements CfdiValidator {
  async validate(input: CfdiValidationInput): Promise<CfdiValidationResult> {
    const acuse = await consultarCfdiWithRetries({
      rfcEmisor: input.rfcEmisor,
      rfcReceptor: input.rfcReceptor,
      total: input.total,
      uuid: input.uuid,
      selloUltimos8: input.selloUltimos8 ?? null,
    });

    return {
      codigoEstatus: acuse.codigoEstatus,
      estado: acuse.estado,
      esCancelable: acuse.esCancelable,
      estatusCancelacion: acuse.estatusCancelacion,
      validacionEFOS: acuse.validacionEFOS,
    };
  }
}
