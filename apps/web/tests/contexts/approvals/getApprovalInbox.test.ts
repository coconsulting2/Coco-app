/**
 * Unit tests del use-case `getApprovalInbox`: delega en el port
 * `ApprovalInboxQueries.findByApprover` con el actor, statusId y opts.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("~/platform/logger/log/logger.js", () => ({
  Logger: () => ({ info() {}, warn() {}, error() {}, trace() {}, debug() {} }),
}));

import { getApprovalInbox } from "~/contexts/approvals/application/getApprovalInbox.js";
import type {
  ApprovalInboxQueries,
  ApprovalInboxItem,
} from "~/contexts/approvals/domain/ports/ApprovalInboxQueries.js";

describe("getApprovalInbox", () => {
  it("devuelve los items de la bandeja del aprobador", async () => {
    const items: ApprovalInboxItem[] = [
      {
        requestId: 1,
        userId: 7,
        destinationCountry: "MX",
        beginningDate: new Date("2026-04-01"),
        endingDate: new Date("2026-04-03"),
        requestStatus: "Primera Revisión",
        requesterName: "Ada",
      },
    ];
    const inboxQueries: ApprovalInboxQueries = {
      findByApprover: vi.fn(async () => items),
    };

    const result = await getApprovalInbox(9, 2, { organizationId: 101, n: 50 }, { inboxQueries });

    expect(result).toEqual(items);
    expect(inboxQueries.findByApprover).toHaveBeenCalledWith(9, 2, {
      organizationId: 101,
      n: 50,
    });
  });

  it("propaga statusId 3 (N2) y opts vacíos", async () => {
    const inboxQueries: ApprovalInboxQueries = { findByApprover: vi.fn(async () => []) };

    const result = await getApprovalInbox(4, 3, {}, { inboxQueries });

    expect(result).toEqual([]);
    expect(inboxQueries.findByApprover).toHaveBeenCalledWith(4, 3, {});
  });
});
