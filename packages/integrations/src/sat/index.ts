/**
 * @module @coco/integrations/sat
 * @description Public API del wrapper SAT SOAP.
 */
export {
  buildExpresionImpresa,
  normalizeConsultaResult,
  consultarCfdiOnce,
  consultarCfdiWithRetries,
  acuseToCfdiRow,
  type ConsultaInput,
  type ConsultaResult,
  type CfdiRow,
} from "#/sat/consulta.js";
