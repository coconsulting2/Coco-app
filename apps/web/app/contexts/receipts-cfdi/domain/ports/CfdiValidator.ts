/**
 * @module CfdiValidator
 * @description Puerto del slice receipts-cfdi para validar la vigencia de un
 * CFDI ante el SAT (consulta de estado). El adapter por defecto vive en
 * `infrastructure/SatCfdiValidator.ts` y envuelve `@coco/integrations.sat`.
 */

export type CfdiValidationInput = {
  rfcEmisor: string;
  rfcReceptor: string;
  total: number;
  uuid: string;
  /** Últimos 8 caracteres del Sello del CFDI (opcional, mejora coincidencia). */
  selloUltimos8?: string | null;
};

export type CfdiValidationResult = {
  codigoEstatus: string;
  estado: string;
  esCancelable: string;
  estatusCancelacion: string;
  validacionEFOS: string;
};

export interface CfdiValidator {
  /** Consulta el estado del CFDI ante el SAT. Lanza si el endpoint está indisponible. */
  validate(input: CfdiValidationInput): Promise<CfdiValidationResult>;
}
