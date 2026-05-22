/**
 * @module @coco/integrations/duffel
 * @description Public API del wrapper Duffel (flights + stays).
 */
export {
  createDuffelClient,
  __resetDuffelClient,
} from "#/duffel/client.js";

export {
  searchFlightOffers,
  mapFlightOffer,
  type FlightSearchParams,
  type NormalizedFlightOffer,
} from "#/duffel/flights.js";

export {
  searchStays,
  staysSearch,
  staysFetchAllRates,
  mapStaysResults,
  enrichOfferFromFetchAllRates,
  resolveCityToCoordinates,
  clampStaysSearchRadiusKm,
  isStaysAccessDeniedError,
  type StaysGuest,
  type StaysSearchInput,
  type StaysSearchResponse,
  type NormalizedStayOffer,
  type EnrichedRate,
  type EnrichedStayOffer,
  type StaySearchInputApp,
  type StaysAccessDeniedError,
} from "#/duffel/stays.js";
