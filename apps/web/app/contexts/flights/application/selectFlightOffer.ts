/**
 * @module selectFlightOffer
 * @description Use-case puro con DI: persiste la oferta de vuelo elegida por
 * la Agencia para una Request específica.
 */
import type { FlightOfferRepository } from "~/contexts/flights/domain/ports/FlightOfferRepository.js";
import type { SelectedFlightOffer } from "~/contexts/flights/domain/entities/FlightQuote.js";

export type SelectFlightOfferInput = {
  requestId: number;
  offer: SelectedFlightOffer;
};

export type SelectFlightOfferDeps = {
  offerRepo: FlightOfferRepository;
};

export async function selectFlightOffer(
  input: SelectFlightOfferInput,
  deps: SelectFlightOfferDeps,
): Promise<void> {
  await deps.offerRepo.saveSelectedOffer(input.requestId, input.offer);
}
