/**
 * @module ViaticasPolicyChecker
 * @description Puerto para verificar que un anticipo solicitado cumpla los
 * topes definidos en la política de viáticos del tenant. El adapter por
 * defecto wrappea `checkFeeVsViaticosPolicy` del slice `policies`.
 */
export type ViaticasPolicyCheckInput = {
  applicantUserId: number;
  requestedFee: number;
  hotelNeeded: boolean;
};

export interface ViaticasPolicyChecker {
  /**
   * Lanza `ViaticasPolicyExceededError` si el `requestedFee` excede el tope
   * aplicable de la política activa. Si no hay política activa, no-op.
   */
  assertFeeWithinPolicy(input: ViaticasPolicyCheckInput): Promise<void>;
}
