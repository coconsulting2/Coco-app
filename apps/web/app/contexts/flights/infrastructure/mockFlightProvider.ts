/**
 * @module MockFlightProvider
 * @description Adapter del puerto `FlightProvider` con tres vuelos estáticos
 * (fallback demo / FLIGHT_PROVIDER=mock). Paridad con el legacy
 * `services/mockFlightProvider.js`.
 */
import type {
  FlightSearchParams,
  NormalizedFlightOffer,
} from "@coco/integrations/duffel";
import type { FlightProvider } from "~/contexts/flights/domain/ports/FlightProvider.js";

type MockSeed = Omit<NormalizedFlightOffer, "id" | "rawOfferId"> & {
  id: string;
  rawOfferId: string;
};

export class MockFlightProvider implements FlightProvider {
  async searchOffers(
    params: FlightSearchParams,
  ): Promise<NormalizedFlightOffer[]> {
    const origin = String(params.origin || "MEX").toUpperCase();
    const dest = String(params.destination || "CUN").toUpperCase();
    const date = String(params.departureDate || "2026-06-01");
    const returnDate = params.returnDate ? String(params.returnDate) : "";
    const pax = Math.max(1, Math.min(9, Number(params.passengers) || 1));
    const roundTrip = Boolean(returnDate && returnDate > date);

    const seeds: MockSeed[] = [
      {
        id: "mock-zz-001",
        rawOfferId: "mock-zz-001",
        airlineName: "Duffel Airways (sandbox)",
        airlineIata: "ZZ",
        departureAt: `${date}T08:00:00.000Z`,
        arrivalAt: `${date}T11:30:00.000Z`,
        durationLabel: "3h 30m",
        stops: 0,
        totalAmount: 2450 * pax,
        totalCurrency: "MXN",
      },
      {
        id: "mock-exp-002",
        rawOfferId: "mock-exp-002",
        airlineName: "Aerolínea Demo",
        airlineIata: "DM",
        departureAt: `${date}T14:15:00.000Z`,
        arrivalAt: `${date}T18:45:00.000Z`,
        durationLabel: "4h 30m",
        stops: 1,
        totalAmount: 1899.5 * pax,
        totalCurrency: "MXN",
      },
      {
        id: "mock-exp-003",
        rawOfferId: "mock-exp-003",
        airlineName: "Coco Charter",
        airlineIata: "CC",
        departureAt: `${date}T06:00:00.000Z`,
        arrivalAt: `${date}T09:10:00.000Z`,
        durationLabel: "3h 10m",
        stops: 0,
        totalAmount: 3100 * pax,
        totalCurrency: "MXN",
      },
    ];

    return seeds.map((o) => ({
      ...o,
      id: `${o.id}-${origin}-${dest}${roundTrip ? "-rt" : ""}`,
      ...(roundTrip
        ? {
            durationLabel: `${o.durationLabel} (ida y vuelta)`,
            totalAmount: o.totalAmount * 1.85,
          }
        : {}),
    }));
  }
}
