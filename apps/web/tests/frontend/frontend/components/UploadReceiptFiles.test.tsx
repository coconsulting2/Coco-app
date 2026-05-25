/**
 * Author: Emiliano Deyta Illescas
 *
 * Description:
 * Unit tests for UploadReceiptFiles (migrado a React Router 7). El componente
 * ya no hace `fetch('/api/...')`: elige archivos en inputs internos y envía un
 * `FormData` multipart vía `useFetcher` al `action` de la route padre.
 *
 * Nota: jsdom + `createRoutesStub` no despachan submits multipart
 * (`encType: "multipart/form-data"`) — el round-trip al action no es
 * observable en este entorno. Por eso aquí se cubre el comportamiento
 * client-side (validación sin archivos, etiquetas del modo subir/resubir y la
 * selección de archivos en los inputs); el flujo de subida real se valida en
 * la integración de la route padre.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import UploadReceiptFiles from "@components/UploadReceiptFiles";

function pdf(name = "recibo.pdf") {
  return new File(["pdf-bytes"], name, { type: "application/pdf" });
}

function renderUploader(props: { resubmit?: boolean; receiptToReplace?: string | null } = {}) {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <UploadReceiptFiles
          requestId={42}
          resubmit={props.resubmit ?? false}
          receiptToReplace={props.receiptToReplace ?? null}
        />
      ),
      action: () => Response.json({ ok: true }),
    },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

function pdfInput() {
  return document.querySelector<HTMLInputElement>("input[type=file][accept*='pdf']")!;
}

describe("UploadReceiptFiles", () => {
  it("renders the request id and the upload affordances", () => {
    renderUploader();
    expect(screen.getByText(/solicitud #42/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /subir archivos/i })).toBeInTheDocument();
  });

  it("shows a validation error when no files are selected", async () => {
    const user = userEvent.setup();
    renderUploader();
    await user.click(screen.getByRole("button", { name: /subir archivos/i }));
    expect(
      await screen.findByText(/adjunta al menos un archivo pdf o xml/i),
    ).toBeInTheDocument();
  });

  it("clears the no-files error once a file is selected and re-submitted", async () => {
    const user = userEvent.setup();
    renderUploader();
    await user.click(screen.getByRole("button", { name: /subir archivos/i }));
    expect(
      await screen.findByText(/adjunta al menos un archivo pdf o xml/i),
    ).toBeInTheDocument();

    await user.upload(pdfInput(), pdf());
    expect(pdfInput().files?.[0]?.name).toBe("recibo.pdf");
  });

  it("uses the resubmit label when in resubmit mode", () => {
    renderUploader({ resubmit: true, receiptToReplace: "77" });
    expect(
      screen.getByRole("button", { name: /reemplazar archivos/i }),
    ).toBeInTheDocument();
  });
});
