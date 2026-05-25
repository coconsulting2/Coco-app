/**
 * Author: Emiliano Deyta Illescas
 *
 * Description:
 * Unit tests for CfdiSatBadge (prop-driven). Covers the three SAT statuses
 * (vigente / cancelado / no_encontrado) with their correct colored pills and
 * labels, the formatted verification timestamp, and the 'Sin datos' fallback
 * when no validation prop is provided. The badge no longer performs any HTTP
 * call: the SAT validation result is resolved server-side by the route loader
 * and passed in as the `validation` prop.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CfdiSatBadge from "@components/CfdiSatBadge";

describe("CfdiSatBadge", () => {
  it("renders the 'Vigente' pill with success styles when status is vigente", () => {
    render(
      <CfdiSatBadge
        validation={{ status: "vigente", verified_at: "2026-04-15T10:00:00.000Z" }}
      />,
    );
    const pill = screen.getByText("Vigente");
    expect(pill.className).toMatch(/bg-\[var\(--color-success-50\)\]/);
    expect(pill.className).toMatch(/text-\[var\(--color-success-500\)\]/);
  });

  it("renders the 'Cancelado' pill with error styles", () => {
    render(
      <CfdiSatBadge
        validation={{ status: "cancelado", verified_at: "2026-04-15T10:00:00.000Z" }}
      />,
    );
    const pill = screen.getByText("Cancelado");
    expect(pill.className).toMatch(/bg-\[var\(--color-error-50\)\]/);
    expect(pill.className).toMatch(/text-\[var\(--color-error-400\)\]/);
  });

  it("renders the 'No encontrado' pill with neutral styles", () => {
    render(
      <CfdiSatBadge
        validation={{ status: "no_encontrado", verified_at: "2026-04-15T10:00:00.000Z" }}
      />,
    );
    const pill = screen.getByText("No encontrado");
    expect(pill.className).toMatch(/bg-\[var\(--color-neutral-100\)\]/);
  });

  it("shows the verification timestamp formatted as a Spanish date", () => {
    render(
      <CfdiSatBadge
        validation={{ status: "vigente", verified_at: "2026-04-15T10:00:00.000Z" }}
      />,
    );
    const timestamp = screen.getByText(/Verificado:/i);
    expect(timestamp.textContent).toMatch(/\d{2}/);
  });

  it("renders the 'Sin datos' fallback when no validation is provided", () => {
    render(<CfdiSatBadge validation={null} />);
    expect(screen.getByText("Sin datos")).toBeInTheDocument();
  });

  it("omits the timestamp when verified_at is empty", () => {
    render(<CfdiSatBadge validation={{ status: "vigente", verified_at: "" }} />);
    expect(screen.queryByText(/Verificado:/i)).toBeNull();
  });
});
