/**
 * Tests para RefundDashboard (M2-006). Prop-driven: el componente recibe `data`
 * desde el loader (`getRefundDashboardForUser` del slice refunds) — ya no hace
 * fetch interno, así que los casos de error/empty se cubren con props.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RefundDashboard from "@components/RefundDashboard";

describe("RefundDashboard", () => {
  it("renders balance and history from data prop", () => {
    render(
      <RefundDashboard
        data={{
          balance: 1234.56,
          history: [
            {
              requestId: 10,
              date: "2026-04-15",
              amount: 500,
              status: 8,
              tripEndDate: "2026-04-10",
              notes: null,
              receiptCount: 2,
            },
          ],
          pendingDeadlineWarning: null,
        }}
      />,
    );
    expect(screen.getByText(/\$1,234\.56/)).toBeInTheDocument();
    expect(screen.getByText("#10")).toBeInTheDocument();
  });

  it("shows fallback when history is empty", () => {
    render(
      <RefundDashboard
        data={{ balance: 0, history: [], pendingDeadlineWarning: null }}
      />,
    );
    expect(screen.getByText(/Sin reembolsos previos/i)).toBeInTheDocument();
  });

  it("renders deadline warning banner when present", () => {
    render(
      <RefundDashboard
        data={{
          balance: 0,
          history: [],
          pendingDeadlineWarning: "La solicitud #5 excedió el plazo.",
        }}
      />,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/excedió el plazo/i)).toBeInTheDocument();
  });
});
