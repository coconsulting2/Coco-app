/**
 * @module FlightOfferRepository
 * @description Puerto del slice flights para persistir la oferta de vuelo
 * seleccionada en una Request. El adapter Prisma vive en
 * `infrastructure/PrismaFlightOfferRepository.ts`.
 */
import type { SelectedFlightOffer } from "~/contexts/flights/domain/entities/FlightQuote.js";

export interface FlightOfferRepository {
  /** Persiste la oferta seleccionada en `Request.selectedFlightOffer` (JSON). */
  saveSelectedOffer(requestId: number, offer: SelectedFlightOffer): Promise<void>;
}
