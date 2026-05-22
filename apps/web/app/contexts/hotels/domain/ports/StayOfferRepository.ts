/**
 * @module StayOfferRepository
 * @description Puerto para persistir la oferta de hospedaje seleccionada
 * en una Request. El adapter Prisma vive en
 * `infrastructure/PrismaStayOfferRepository.ts`.
 */
import type { SelectedHotelOffer } from "~/contexts/hotels/domain/entities/HotelQuote.js";

export interface StayOfferRepository {
  saveSelectedOffer(requestId: number, offer: SelectedHotelOffer): Promise<void>;
}
