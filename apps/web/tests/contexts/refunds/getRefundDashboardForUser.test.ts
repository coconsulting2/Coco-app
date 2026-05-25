/**
 * Unit tests del use-case `getRefundDashboardForUser`. Mockea las queries de
 * infraestructura (`refundDashboardQueries`) y el chequeo de plazo
 * (`reimbursementTimeService.isWithinDeadline`). Cubre: usuario inexistente,
 * cálculo del balance + historial (solo comprobantes aprobados+refund), y la
 * advertencia de plazo vencido.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("~/platform/logger/log/logger.js", () => ({
  Logger: () => ({ info() {}, warn() {}, error() {}, trace() {}, debug() {} }),
}));

const findUserWalletAndOrg = vi.fn();
const findUserRequestsWithReceipts = vi.fn();
const isWithinDeadline = vi.fn();

vi.mock("~/contexts/refunds/infrastructure/refundDashboardQueries.js", () => ({
  findUserWalletAndOrg: (...a: unknown[]) => findUserWalletAndOrg(...a),
  findUserRequestsWithReceipts: (...a: unknown[]) => findUserRequestsWithReceipts(...a),
}));

vi.mock("~/contexts/refunds/application/reimbursementTimeService.js", () => ({
  isWithinDeadline: (...a: unknown[]) => isWithinDeadline(...a),
}));

import {
  getRefundDashboardForUser,
  UserNotFoundError,
} from "~/contexts/refunds/application/refundDashboardService.js";

beforeEach(() => {
  findUserWalletAndOrg.mockReset();
  findUserRequestsWithReceipts.mockReset();
  isWithinDeadline.mockReset();
  isWithinDeadline.mockResolvedValue(true);
});

describe("getRefundDashboardForUser", () => {
  it("lanza UserNotFoundError cuando el usuario no existe", async () => {
    findUserWalletAndOrg.mockResolvedValue(null);
    await expect(getRefundDashboardForUser(7)).rejects.toBeInstanceOf(UserNotFoundError);
  });

  it("calcula balance e historial sumando solo comprobantes aprobados con refund", async () => {
    findUserWalletAndOrg.mockResolvedValue({ userId: 7, wallet: 1234.5, organizationId: 101n });
    findUserRequestsWithReceipts.mockResolvedValue([
      {
        requestId: 1,
        requestStatusId: 8,
        creationDate: new Date("2026-04-01T00:00:00.000Z"),
        tripEndDate: new Date("2026-04-05T00:00:00.000Z"),
        requestedFee: 0,
        imposedFee: 0,
        notes: "viaje 1",
        receipts: [
          { receiptId: 1, amount: 500, refund: true, validation: "Aprobado", submissionDate: null },
          { receiptId: 2, amount: 300, refund: true, validation: "Pendiente", submissionDate: null },
          { receiptId: 3, amount: 200, refund: false, validation: "Aprobado", submissionDate: null },
        ],
      },
    ]);

    const result = await getRefundDashboardForUser(7);

    expect(result.balance).toBe(1234.5);
    expect(result.history).toHaveLength(1);
    expect(result.history[0]).toMatchObject({
      requestId: 1,
      amount: 500, // solo el receipt aprobado+refund
      status: 8,
      receiptCount: 3,
      notes: "viaje 1",
    });
    expect(result.pendingDeadlineWarning).toBeNull();
  });

  it("emite advertencia cuando una solicitud excedió el plazo", async () => {
    findUserWalletAndOrg.mockResolvedValue({ userId: 7, wallet: 0, organizationId: 101n });
    findUserRequestsWithReceipts.mockResolvedValue([
      {
        requestId: 42,
        requestStatusId: 8,
        creationDate: new Date("2026-04-01T00:00:00.000Z"),
        tripEndDate: new Date("2026-04-05T00:00:00.000Z"),
        requestedFee: 0,
        imposedFee: 0,
        notes: null,
        receipts: [],
      },
    ]);
    isWithinDeadline.mockResolvedValue(false);

    const result = await getRefundDashboardForUser(7);

    expect(result.pendingDeadlineWarning).toMatch(/#42 excedió el plazo/i);
  });
});
