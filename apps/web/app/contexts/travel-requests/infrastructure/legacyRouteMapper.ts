/**
 * @module legacyRouteMapper
 * @description Mapea un `RouteLeg` del dominio (camelCase) al shape snake_case
 * que esperan los flujos transaccionales legacy del `applicantModel`
 * (`createTravelRequest`, `editTravelRequest`, `createDraftTravelRequest`).
 * Compartido por los adapters del slice.
 */
import type { RouteLeg } from "~/contexts/travel-requests/domain/entities/Request.js";

export type LegacyRoute = {
  router_index: number;
  origin_country_name: string;
  origin_city_name: string;
  destination_country_name: string;
  destination_city_name: string;
  beginning_date: string;
  beginning_time: string | null;
  ending_date: string;
  ending_time: string | null;
  plane_needed: boolean;
  hotel_needed: boolean;
};

export function legToSnake(
  leg: Omit<RouteLeg, "routerIndex">,
  routerIndex: number,
): LegacyRoute {
  return {
    router_index: routerIndex,
    origin_country_name: leg.originCountryName,
    origin_city_name: leg.originCityName,
    destination_country_name: leg.destinationCountryName,
    destination_city_name: leg.destinationCityName,
    beginning_date: leg.beginningDate,
    beginning_time: leg.beginningTime,
    ending_date: leg.endingDate,
    ending_time: leg.endingTime,
    plane_needed: leg.planeNeeded,
    hotel_needed: leg.hotelNeeded,
  };
}
