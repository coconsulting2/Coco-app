/**
 * @module flightProvider
 * @description Selección del adapter de vuelos según `FLIGHT_PROVIDER` (TF-010).
 * La lógica de SDK vive en `@coco/integrations/duffel`; aquí solo se elige el
 * adapter concreto. Paridad con el legacy `services/flightProvider.js`.
 */
import { MockFlightProvider } from "~/contexts/flights/infrastructure/mockFlightProvider.js";
import { DuffelFlightProvider } from "~/contexts/flights/infrastructure/duffelFlightProvider.js";
import type { FlightProvider } from "~/contexts/flights/domain/ports/FlightProvider.js";

/** Etiqueta del proveedor activo (para el contrato de respuesta). */
export type FlightProviderLabel = "duffel" | "mock";

export function resolveFlightProviderMode(): FlightProviderLabel {
  return String(process.env.FLIGHT_PROVIDER || "mock").toLowerCase() === "duffel"
    ? "duffel"
    : "mock";
}

export function getFlightProvider(): FlightProvider {
  return resolveFlightProviderMode() === "duffel"
    ? new DuffelFlightProvider()
    : new MockFlightProvider();
}
