/**
 * @module CxpAttendRepository
 * @description Puerto mínimo para que CxP confirme el monto aprobado de una
 * Request y avance su status. El resto del slice accounts-payable (queries
 * complejas de pólizas, accounting export) queda pendiente para refactor
 * futuro.
 */

/** Estado actual de la Request relevante para la confirmación de CxP. */
export interface CxpAttendState {
  /** Status actual de la Request (debe ser 4 para poder atenderse). */
  requestStatusId: number;
  /** True si alguna ruta de la Request requiere vuelo. */
  needsPlane: boolean;
  /** True si alguna ruta de la Request requiere hotel. */
  needsHotel: boolean;
}

export interface CxpAttendRepository {
  /**
   * Lee el estado de la Request: status actual + si necesita pasar por Agencia
   * (hotel o vuelo). Devuelve `null` si la Request no existe.
   */
  getAttendState(requestId: number): Promise<CxpAttendState | null>;

  /**
   * Persiste el monto aprobado y avanza el status. Si `needsAgency` es true,
   * transición a status 5 (Atención Agencia); en otro caso, a status 6
   * (Comprobación de gastos del viaje).
   */
  assignImposedFee(
    requestId: number,
    imposedFee: number,
    nextStatusId: 5 | 6,
  ): Promise<void>;
}
