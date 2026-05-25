/**
 * @module PoliciesViaticasPolicyChecker
 * @description Adapter para el port `ViaticasPolicyChecker`. Wrappea
 * `checkFeeVsViaticosPolicy` del slice `policies` (que internamente lee la
 * `ViaticasPolicy` activa del tenant y aplica el cap apropiado según
 * `hotelNeeded`). El legacy lanza `Error & { status: 422 }`; lo traducimos
 * a `ViaticasPolicyExceededError` para que la action lo mappee a HTTP 422.
 */
import { checkFeeVsViaticosPolicy } from "~/contexts/policies/index.js";
import type {
  ViaticasPolicyChecker,
  ViaticasPolicyCheckInput,
} from "~/contexts/travel-requests/domain/ports/ViaticasPolicyChecker.js";
import { ViaticasPolicyExceededError } from "~/contexts/travel-requests/domain/errors.js";

type LegacyPolicyError = Error & { status?: number };

export class PoliciesViaticasPolicyChecker implements ViaticasPolicyChecker {
  async assertFeeWithinPolicy(input: ViaticasPolicyCheckInput): Promise<void> {
    try {
      await checkFeeVsViaticosPolicy(
        input.applicantUserId,
        input.requestedFee,
        input.hotelNeeded,
      );
    } catch (err) {
      const e = err as LegacyPolicyError;
      if (e?.status === 422) {
        throw new ViaticasPolicyExceededError(e.message);
      }
      throw err;
    }
  }
}
