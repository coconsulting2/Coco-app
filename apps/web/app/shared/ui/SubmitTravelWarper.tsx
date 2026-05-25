/**
 * @module SubmitTravelWarper
 * @description Helpers puros (sin I/O) compartidos entre el formulario de
 * comprobación (`ExpensesForm`) y la action RR7 de `subir-comprobante.$id`.
 *
 * Histórico: este módulo exportaba `submitTravelExpense`, que disparaba
 * `apiRequest` a `/applicant/create-expense-validation` y luego a
 * `/accounts-payable/get-expense-validations/:id` para descubrir el
 * `lastReceiptId`. Esa orquestación ahora vive en la action RR7
 * (`subir-comprobante.$id`) consumiendo los use-cases del slice
 * (`createExpenseValidationBatch` + `getReceiptsForRequestValidation`), por lo
 * que aquí sólo queda el mapeo concepto → receiptTypeId, que es la regla de
 * negocio compartida 1:1 con el seed (M2-006).
 */

/** Mapping concepto (label visible) → receiptTypeId del seed (M2-006). */
export const CONCEPTO_TO_RECEIPT_TYPE_ID: Record<string, number> = {
  Hospedaje: 1,
  Comida: 2,
  Transporte: 3,
  Caseta: 4,
  Autobús: 5,
  Vuelo: 6,
  Otro: 7,
};

/** Lista de conceptos en el orden histórico del `<select>` del formulario. */
export const CONCEPTO_OPTIONS: readonly string[] = [
  "Transporte",
  "Hospedaje",
  "Comida",
  "Caseta",
  "Autobús",
  "Vuelo",
  "Otro",
];

/** Resuelve el receiptTypeId de un concepto; lanza si es inválido (paridad legacy). */
export function receiptTypeIdForConcepto(concepto: string): number {
  const id = CONCEPTO_TO_RECEIPT_TYPE_ID[concepto];
  if (!id) throw new Error(`Concepto inválido: ${concepto}`);
  return id;
}
