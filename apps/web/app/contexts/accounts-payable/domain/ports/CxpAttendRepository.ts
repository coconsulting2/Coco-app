/**
 * @module CxpAttendRepository
 * @description Puerto mínimo para que CxP confirme el monto aprobado de una
 * Request y avance su status. El resto del slice accounts-payable (queries
 * complejas de pólizas, accounting export) queda pendiente para refactor
 * futuro.
 */

export interface CxpAttendRepository {
  /** Lee si la Request necesita pasar por Agencia (hotel o vuelo). */
  getAgencyNeeds(
    requestId: number,
  ): Promise<{ needsPlane: boolean; needsHotel: boolean } | null>;

  /**
   * Persiste el monto aprobado y avanza el status. Si `needsAgency` es true,
   * transición a status 5 (Atención Agencia); en otro caso, a status 7
   * (Comprobación gastos del viaje).
   */
  assignImposedFee(
    requestId: number,
    imposedFee: number,
    nextStatusId: 5 | 7,
  ): Promise<void>;
}
