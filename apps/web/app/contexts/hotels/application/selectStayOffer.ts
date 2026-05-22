/**
 * @module selectStayOffer
 * @description Use-case puro con DI. Si la oferta es de Duffel Stays y aún
 * no trae rates resueltos, dispara `fetchAllRates` + enrichment antes de
 * persistir. Esto reproduce la lógica del legacy `seleccionarHotel`.
 */
import {
  staysFetchAllRates,
  enrichOfferFromFetchAllRates,
} from "@coco/integrations/duffel";
import type { StayOfferRepository } from "~/contexts/hotels/domain/ports/StayOfferRepository.js";
import type {
  StayOffer,
  SelectedHotelOffer,
} from "~/contexts/hotels/domain/entities/HotelQuote.js";

export type SelectStayOfferInput = {
  requestId: number;
  offer: StayOffer;
};

export type SelectStayOfferDeps = {
  offerRepo: StayOfferRepository;
};

export type SelectStayOfferResult = {
  saved: SelectedHotelOffer;
};

export async function selectStayOffer(
  input: SelectStayOfferInput,
  deps: SelectStayOfferDeps,
): Promise<SelectStayOfferResult> {
  let toSave: SelectedHotelOffer = input.offer;

  const searchResultId = input.offer.searchResultId ?? input.offer.id;
  const isDuffelStays =
    input.offer.provider === "duffel_stays" && searchResultId.startsWith("srr_");

  if (isDuffelStays) {
    try {
      const response = await staysFetchAllRates(searchResultId);
      const enriched = enrichOfferFromFetchAllRates(
        response.data as Parameters<typeof enrichOfferFromFetchAllRates>[0],
        input.offer,
      );
      toSave = enriched;
    } catch (err) {
      console.warn(
        "[selectStayOffer] fetch_all_rates no disponible, guardando oferta resumida:",
        (err as Error).message,
      );
    }
  }

  await deps.offerRepo.saveSelectedOffer(input.requestId, toSave);
  return { saved: toSave };
}
