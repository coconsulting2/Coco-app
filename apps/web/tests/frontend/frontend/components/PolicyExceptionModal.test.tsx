/**
 * Tests para PolicyExceptionModal (M2-006 RF-45).
 *
 * El componente fue migrado fuera de `apiRequest`: ahora es prop-driven +
 * `useFetcher`, enviando un intent `policy-exception:create` con el payload a la
 * `action` de la ruta anfitriona y disparando `onCreated({ exceptionId })`
 * cuando la action responde `{ ok: true, exceptionId }`. Usamos
 * `createRoutesStub` para proveer el data-router de RR7 y capturar el submit.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import PolicyExceptionModal, {
  type PolicyExceptionModalProps,
} from "@components/PolicyExceptionModal";

const baseProps: PolicyExceptionModalProps = {
  open: true,
  onClose: vi.fn(),
  onCreated: vi.fn(),
  requestId: 5,
  receiptId: 50,
  policyId: 1,
  capId: 100,
  amountClaimed: 5000,
  excessAmount: 1500,
};

function renderModal(
  props: PolicyExceptionModalProps,
  onAction?: (payload: Record<string, unknown>) => unknown,
) {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <PolicyExceptionModal {...props} />,
      action: async ({ request }) => {
        const form = await request.formData();
        expect(form.get("intent")).toBe("policy-exception:create");
        const payload = JSON.parse(String(form.get("payload")));
        const result = onAction?.(payload);
        return Response.json(result ?? { ok: true, exceptionId: 99 });
      },
    },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

describe("PolicyExceptionModal", () => {
  it("does NOT render when open=false", () => {
    renderModal({ ...baseProps, open: false });
    expect(screen.queryByLabelText(/Justificación/i)).toBeNull();
  });

  it("blocks submit when justification is too short", async () => {
    const onCreated = vi.fn();
    let actionCalled = false;
    renderModal({ ...baseProps, onCreated }, () => {
      actionCalled = true;
      return { ok: true, exceptionId: 1 };
    });

    const textarea = screen.getByLabelText(/Justificación/i);
    await userEvent.type(textarea, "no");
    await userEvent.click(screen.getByRole("button", { name: /enviar/i }));

    // Error de validación inline (Zod) en el <small>; el <p> del Modal también
    // menciona "10 caracteres", así que filtramos por tag.
    const matches = await screen.findAllByText(/10 caracteres/i);
    expect(matches.some((el) => el.tagName.toLowerCase() === "small")).toBe(true);
    expect(onCreated).not.toHaveBeenCalled();
    expect(actionCalled).toBe(false);
  });

  it("submits the payload and invokes onCreated when justification is valid", async () => {
    const onCreated = vi.fn();
    const onClose = vi.fn();
    let receivedPayload: Record<string, unknown> | null = null;

    renderModal({ ...baseProps, onCreated, onClose }, (payload) => {
      receivedPayload = payload;
      return { ok: true, exceptionId: 99 };
    });

    await userEvent.type(
      screen.getByLabelText(/Justificación/i),
      "Justificación válida con motivo claro y suficiente.",
    );
    await userEvent.click(screen.getByRole("button", { name: /enviar/i }));

    await waitFor(() =>
      expect(onCreated).toHaveBeenCalledWith({ exceptionId: 99 }),
    );
    expect(onClose).toHaveBeenCalled();
    expect(receivedPayload).toMatchObject({
      requestId: 5,
      receiptId: 50,
      policyId: 1,
      capId: 100,
      amountClaimed: 5000,
      excessAmount: 1500,
      justification: "Justificación válida con motivo claro y suficiente.",
    });
  });

  it("surfaces the action error on the justification field", async () => {
    const onCreated = vi.fn();
    renderModal({ ...baseProps, onCreated }, () => ({
      ok: false,
      error: "El cap ya no admite excepciones",
    }));

    await userEvent.type(
      screen.getByLabelText(/Justificación/i),
      "Justificación válida con motivo claro y suficiente.",
    );
    await userEvent.click(screen.getByRole("button", { name: /enviar/i }));

    expect(
      await screen.findByText(/cap ya no admite excepciones/i),
    ).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
  });
});
