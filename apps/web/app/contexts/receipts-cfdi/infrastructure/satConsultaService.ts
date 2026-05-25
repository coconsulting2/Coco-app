/**
 * @module satConsultaService
 * @description Wrapper tipado del cliente SOAP de Consulta de Estado de CFDI
 * (SAT). La implementación SOAP vive en `@coco/integrations/sat` (aislamiento
 * 3rd-party + mocks en tests); este módulo sólo re-exporta el contrato para los
 * consumidores internos del slice receipts-cfdi.
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
} from "@coco/integrations/sat";
