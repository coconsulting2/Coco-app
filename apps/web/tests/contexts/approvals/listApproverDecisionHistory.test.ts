/**
 * Unit tests del use-case `listApproverDecisionHistory`: delega en el port
 * `ApproverDecisionHistoryQueries.findByApprover` con el aprobador y opts, y
 * cortocircuita en IDs inválidos sin tocar el port.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("~/platform/logger/log/logger.js", () => ({
  Logger: () => ({ info() {}, warn() {}, error() {}, trace() {}, debug() {} }),
}));

import { listApproverDecisionHistory } from "~/contexts/approvals/application/listApproverDecisionHistory.js";
import type {
  ApproverDecisionHistoryQueries,
  ApproverDecisionHistoryItem,
} from "~/contexts/approvals/domain/ports/ApproverDecisionHistoryQueries.js";

describe("listApproverDecisionHistory", () => {
  it("devuelve el histórico de decisiones del aprobador", async () => {
    const items: ApproverDecisionHistoryItem[] = [
      {
        historialId: 10,
        requestId: 1,
        action: "APROBADO",
        comentario: null,
        decidedAt: new Date("2026-04-05T12:00:00.000Z"),
        destinationCountry: "MX",
        beginningDate: new Date("2026-04-01"),
        endingDate: new Date("2026-04-03"),
        requestStatus: "Segunda Revisión",
        requesterName: "Ada",
      },
      {
        historialId: 9,
        requestId: 2,
        action: "RECHAZADO",
        comentario: "Fuera de presupuesto",
        decidedAt: new Date("2026-04-04T12:00:00.000Z"),
        destinationCountry: "US",
        beginningDate: null,
        endingDate: null,
        requestStatus: "Rechazada",
        requesterName: "Grace",
      },
    ];
    const historyQueries: ApproverDecisionHistoryQueries = {
      findByApprover: vi.fn(async () => items),
    };

    const result = await listApproverDecisionHistory(
      9,
      { organizationId: 101, n: null },
      { historyQueries },
    );

    expect(result).toEqual(items);
    expect(historyQueries.findByApprover).toHaveBeenCalledWith(9, {
      organizationId: 101,
      n: null,
    });
  });

  it("propaga opts vacíos", async () => {
    const historyQueries: ApproverDecisionHistoryQueries = {
      findByApprover: vi.fn(async () => []),
    };

    const result = await listApproverDecisionHistory(4, {}, { historyQueries });

    expect(result).toEqual([]);
    expect(historyQueries.findByApprover).toHaveBeenCalledWith(4, {});
  });

  it("cortocircuita en approverUserId inválido sin tocar el port", async () => {
    const historyQueries: ApproverDecisionHistoryQueries = {
      findByApprover: vi.fn(async () => []),
    };

    const result = await listApproverDecisionHistory(0, {}, { historyQueries });

    expect(result).toEqual([]);
    expect(historyQueries.findByApprover).not.toHaveBeenCalled();
  });
});
