/**
 * @module @coco/integrations
 * @description Wrappers tipados de servicios externos. Toda integración 3rd-party
 * vive aquí para aislamiento (cambios de proveedor, mocks en tests, posible
 * reuso desde @coco/scheduler u otra app futura).
 */
export * as duffel from "#/duffel/index.js";
export * as sat from "#/sat/index.js";

// Re-export directo de tipos comunes (conveniencia).
export type {
  FlightSearchParams,
  NormalizedFlightOffer,
  NormalizedStayOffer,
  EnrichedStayOffer,
  StaysGuest,
  StaySearchInputApp,
} from "#/duffel/index.js";

export type {
  ConsultaInput,
  ConsultaResult,
  CfdiRow,
} from "#/sat/index.js";
