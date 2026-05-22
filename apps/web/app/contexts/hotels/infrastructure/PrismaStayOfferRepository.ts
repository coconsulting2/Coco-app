/**
 * @module PrismaStayOfferRepository
 * @description Adapter Prisma del puerto `StayOfferRepository`. Persiste
 * `Request.selectedHotelOffer` como JSON denormalizado.
 */
import prisma from "~/platform/db/prisma.server.js";
import type { StayOfferRepository } from "~/contexts/hotels/domain/ports/StayOfferRepository.js";
import type { SelectedHotelOffer } from "~/contexts/hotels/domain/entities/HotelQuote.js";

export class PrismaStayOfferRepository implements StayOfferRepository {
  async saveSelectedOffer(
    requestId: number,
    offer: SelectedHotelOffer,
  ): Promise<void> {
    await prisma.request.update({
      where: { requestId: Number(requestId) },
      data: { selectedHotelOffer: offer as unknown as object },
    });
  }
}
