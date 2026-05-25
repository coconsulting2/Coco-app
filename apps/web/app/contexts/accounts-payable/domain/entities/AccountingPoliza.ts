/**
 * @module AccountingPoliza
 * @description Shape tipado de una póliza contable SAT/GL tal como la consume
 * el ERP del cliente y la UI de exportación. Espeja la estructura que el
 * servicio legacy (`accountingExportService`) construye (cabecera + detalle en
 * claves SAP), expuesta ahora con tipos puros.
 *
 * SHKZG: indicador Debe/Haber — "S" = Debe (Soll), "H" = Haber (Haben).
 * DOC_TYPE: "AV" = Anticipo de Viaje, "GV" = Gasto/Comprobación de Viaje.
 */

/** Cabecera de la póliza en claves SAP. */
export type AccountingPolizaHeader = {
  ID_VIAJE: string;
  DOC_TYPE: string;
  HEADER_TXT: string;
  COMP_CODE: string;
  PSTNG_DATE: string;
  CURRENCY: string;
  EXCH_RATE: number;
};

/** Línea de detalle (partida contable) en claves SAP. */
export type AccountingPolizaLine = {
  ITEMNO_ACC: number;
  SHKZG: string;
  GL_ACCOUNT: string;
  ITEM_TEXT: string;
  AMT_DOCCUR: number;
  COSTCENTER?: string;
  VENDOR_NO?: string;
};

/**
 * Póliza contable construida a partir de un Request finalizado.
 * `detalle` es la forma canónica del backend legacy.
 */
export type AccountingPoliza = {
  header: AccountingPolizaHeader;
  detalle: AccountingPolizaLine[];
};
