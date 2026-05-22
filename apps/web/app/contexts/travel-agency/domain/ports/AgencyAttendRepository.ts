/**
 * @module AgencyAttendRepository
 * @description Puerto mínimo para marcar una Request como atendida por la
 * Agencia (transición a status 6 = "Comprobación gastos del viaje"). El
 * resto de capacidades del slice travel-agency quedan para refactor futuro.
 */

export interface AgencyAttendRepository {
  /** Verifica que la Request exista. */
  requestExists(requestId: number): Promise<boolean>;
  /** Avanza la Request a status 6 (Comprobación gastos del viaje). */
  markAttended(requestId: number): Promise<void>;
}
