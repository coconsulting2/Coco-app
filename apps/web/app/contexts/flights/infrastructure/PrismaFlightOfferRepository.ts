/**
 * @module PrismaFlightOfferRepository
 * @description Adapter Prisma del puerto `FlightOfferRepository`. Persiste
 * `Request.selectedFlightOffer` como JSON denormalizado.
 */
import prisma from "~/platform/db/prisma.server.js";
import type { FlightOfferRepository } from "~/contexts/flights/domain/ports/FlightOfferRepository.js";
import type { SelectedFlightOffer } from "~/contexts/flights/domain/entities/FlightQuote.js";

export class PrismaFlightOfferRepository implements FlightOfferRepository {
  async saveSelectedOffer(
    requestId: number,
    offer: SelectedFlightOffer,
  ): Promise<void> {
    await prisma.request.update({
      where: { requestId: Number(requestId) },
      data: { selectedFlightOffer: offer as unknown as object },
    });
  }
}
