/**
 * Tests para RefundTimeLimitConfig (M2-006 RF-37).
 *
 * El componente es prop-driven + `useFetcher` (migrado fuera de `apiRequest`):
 * recibe `config`/`csrfToken` por prop y POSTea al action de la route padre.
 * Usamos `createRoutesStub` para proveer el router de RR7 y capturar el submit.
 */
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import RefundTimeLimitConfig from "@components/RefundTimeLimitConfig";

function renderConfig(
  config = { daysAfterTrip: 7, graceDays: 1, blockOnExpiry: false, active: true },
  onAction?: (form: FormData) => void,
) {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <RefundTimeLimitConfig config={config} csrfToken="tok-123" />,
      action: async ({ request }) => {
        const form = await request.formData();
        onAction?.(form);
        return Response.json({
          ok: true,
          config: {
            daysAfterTrip: Number(form.get("daysAfterTrip")),
            graceDays: Number(form.get("graceDays")),
            blockOnExpiry: form.get("blockOnExpiry") === "true",
            active: true,
          },
        });
      },
    },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

describe("RefundTimeLimitConfig", () => {
  it("renders the initial config from props", () => {
    renderConfig();
    expect((screen.getByLabelText(/Días después/i) as HTMLInputElement).value).toBe("7");
    expect((screen.getByLabelText(/gracia adicionales/i) as HTMLInputElement).value).toBe("1");
  });

  it("submits the edited values (with csrf token) to the route action", async () => {
    const user = userEvent.setup();
    let received: FormData | null = null;
    renderConfig(
      { daysAfterTrip: 14, graceDays: 0, blockOnExpiry: true, active: true },
      (form) => {
        received = form;
      },
    );

    const input = screen.getByLabelText(/Días después/i);
    await user.clear(input);
    await user.type(input, "30");
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(received).not.toBeNull());
    expect(received!.get("daysAfterTrip")).toBe("30");
    expect(received!.get("_csrf")).toBe("tok-123");
    await screen.findByText(/configuración actualizada/i);
  });
});
