/**
 * Unit test del use-case `getSolicitudJourney` con stub in-memory del port
 * `RequestJourneyQueries` — sin DB. Cubre:
 *  - request inexistente → null
 *  - status en revisión (2) marca pasos completados/actual/pendiente
 *  - cancelado (9) agrega paso "Cancelado" failed
 *  - rechazado (10) agrega paso "Rechazado" failed con datos del historial
 *  - los eventos del historial se proyectan a `events`
 */
import { describe, it, expect } from "vitest";
import { getSolicitudJourney } from "~/contexts/travel-requests/application/getSolicitudJourney";
import type {
  RequestJourneyQueries,
  RequestJourneyData,
} from "~/contexts/travel-requests/domain/ports/RequestJourneyQueries";

function makeData(overrides: Partial<RequestJourneyData> = {}): RequestJourneyData {
  return {
    currentStatusId: 2,
    currentStatusLabel: "Primera revisión",
    workflowPreSnapshot: { levels: [1, 2] },
    routeRequests: [{ route: { hotelNeeded: true, planeNeeded: false } }],
    creationDate: new Date("2026-05-01T10:00:00.000Z"),
    historial: [],
    ...overrides,
  };
}

function stubQueries(data: RequestJourneyData | null): RequestJourneyQueries {
  return {
    getJourneyData: async () => data,
  };
}

describe("getSolicitudJourney", () => {
  it("devuelve null cuando la solicitud no existe", async () => {
    const result = await getSolicitudJourney(
      { requestId: 999 },
      { journey: stubQueries(null) },
    );
    expect(result).toBeNull();
  });

  it("marca pasos completados/actual/pendiente según el status actual (2)", async () => {
    const result = await getSolicitudJourney(
      { requestId: 1 },
      { journey: stubQueries(makeData({ currentStatusId: 2 })) },
    );
    expect(result).not.toBeNull();
    const draft = result!.steps.find((s) => s.key === "draft");
    const n1 = result!.steps.find((s) => s.key === "n1");
    const n2 = result!.steps.find((s) => s.key === "n2");
    expect(draft?.state).toBe("completed");
    expect(n1?.state).toBe("current");
    expect(n2?.state).toBe("pending");
    expect(result!.currentStatusLabel).toBe("Primera revisión");
  });

  it("agrega paso 'Cancelado' (failed) cuando el status es 9", async () => {
    const result = await getSolicitudJourney(
      { requestId: 1 },
      {
        journey: stubQueries(
          makeData({ currentStatusId: 9, currentStatusLabel: "Cancelada" }),
        ),
      },
    );
    const cancelled = result!.steps.find((s) => s.key === "cancelled");
    expect(cancelled).toBeDefined();
    expect(cancelled?.state).toBe("failed");
    expect(cancelled?.label).toBe("Cancelado");
  });

  it("agrega paso 'Rechazado' (failed) con datos del historial cuando el status es 10", async () => {
    const result = await getSolicitudJourney(
      { requestId: 1 },
      {
        journey: stubQueries(
          makeData({
            currentStatusId: 10,
            currentStatusLabel: "Rechazada",
            historial: [
              {
                accion: "RECHAZADO",
                createdAt: new Date("2026-05-03T12:00:00.000Z"),
                comentario: "Falta justificación",
                user: { userName: "Kevin", role: { roleName: "N2" } },
              },
            ],
          }),
        ),
      },
    );
    const rejected = result!.steps.find((s) => s.key === "rejected");
    expect(rejected?.state).toBe("failed");
    expect(rejected?.actor).toBe("Kevin");
    expect(rejected?.note).toBe("Falta justificación");
  });

  it("proyecta el historial a eventos legibles", async () => {
    const result = await getSolicitudJourney(
      { requestId: 1 },
      {
        journey: stubQueries(
          makeData({
            historial: [
              {
                accion: "APROBADO",
                createdAt: new Date("2026-05-02T09:00:00.000Z"),
                comentario: null,
                user: { userName: "Santino", role: { roleName: "N1" } },
              },
            ],
          }),
        ),
      },
    );
    expect(result!.events).toHaveLength(1);
    expect(result!.events[0]).toMatchObject({
      action: "APROBADO",
      user: "Santino",
      role: "N1",
    });
  });
});
