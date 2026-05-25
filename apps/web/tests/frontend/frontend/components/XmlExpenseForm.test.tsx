/**
 * Author: Emiliano Deyta Illescas
 *
 * Description:
 * Unit tests for XmlExpenseForm (migrado a React Router 7). El componente ya
 * no hace HTTP propio: arma `FormData` y lo envía vía `useFetcher` al `action`
 * de la route padre, discriminado por `intent`
 * (parseXml | fxPreview | registerNational | registerInternational).
 *
 * Nota: jsdom + `createRoutesStub` no despachan submits multipart
 * (`encType: "multipart/form-data"`), por lo que el autollenado vía `parseXml`
 * (que sube el archivo XML) no es observable aquí; se valida en la integración
 * de la route padre. Estos tests cubren el comportamiento client-side: render,
 * validación zod, selección de tipo de gasto y bloqueo de submit vacío.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import XmlExpenseForm from "@components/XmlExpenseForm";

interface RenderOptions {
  onSuccess?: () => void;
}

function renderForm({ onSuccess }: RenderOptions = {}) {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <XmlExpenseForm receiptId={1} onSuccess={onSuccess} />,
      action: () => Response.json({ ok: true, intent: "registerNational", receiptId: 1 }),
    },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

describe("XmlExpenseForm", () => {
  it("renders the XML upload input and empty readonly fields initially", () => {
    renderForm();
    expect(screen.getByText(/archivo xml del cfdi/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /guardar comprobación/i }),
    ).toBeInTheDocument();
  });

  it("shows zod validation errors when submitting without any data", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(
      screen.getByRole("button", { name: /guardar comprobación/i }),
    );
    expect(
      await screen.findByText(/rfc debe tener al menos 12 caracteres/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/uuid es requerido/i)).toBeInTheDocument();
    expect(screen.getByText(/selecciona un tipo de gasto/i)).toBeInTheDocument();
  });

  it("allows the user to select an expense type from the dropdown", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.selectOptions(screen.getByRole("combobox"), "3");
    const selected = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selected.value).toBe("3");
  });

  it("does not call onSuccess when the form is submitted empty (zod blocks submission)", async () => {
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    renderForm({ onSuccess });
    await user.click(
      screen.getByRole("button", { name: /guardar comprobación/i }),
    );
    expect(await screen.findByText(/uuid es requerido/i)).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
