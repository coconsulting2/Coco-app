/**
 * @module AnticipoPolizaPort
 * @description Port para emitir póliza AV al aprobar la solicitud (status 4).
 * Implementado por el slice `accounts-payable/`. Falla suave: errores se
 * logean pero no bloquean el flujo de aprobación.
 */
export interface AnticipoPolizaPort {
  onTravelRequestFullyApproved(requestId: number): Promise<void>;
}
