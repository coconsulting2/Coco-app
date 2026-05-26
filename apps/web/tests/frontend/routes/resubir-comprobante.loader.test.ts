/**
 * @module resubir-comprobante.loader.test
 * @description Verifica que el loader de `resubir-comprobante.$id` lea el query
 * param `replace` y lo devuelva como `receiptToReplace`, de modo que la vista
 * lo pase a `ExpensesForm` y la action borre el comprobante rechazado anterior.
 * `requirePermissions` se mockea para aislar el parseo del URL.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/platform/session/requireUser.server", () => ({
  requirePermissions: vi.fn(async () => ({})),
}));

// Corta la cadena de imports a Prisma (`@coco/db`) que arrastra
// `subir-comprobante.server` (deleteReceiptFile → repos → prisma.server),
// que `resubir-comprobante.$id` importa para su action.
vi.mock("~/routes/_app/subir-comprobante.server", () => ({
  handleSubirComprobanteAction: vi.fn(),
}));

import { loader } from "~/routes/_app/resubir-comprobante.$id";

function makeArgs(url: string, id: string) {
  return {
    request: new Request(url),
    params: { id },
    context: {},
  } as unknown as Parameters<typeof loader>[0];
}

describe("resubir-comprobante loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve receiptToReplace='99' cuando la URL trae ?replace=99", async () => {
    const data = await loader(
      makeArgs("https://localhost/resubir-comprobante/12?replace=99", "12"),
    );
    expect(data).toEqual({
      requestId: 12,
      resubmit: true,
      receiptToReplace: "99",
    });
  });

  it("devuelve receiptToReplace=null cuando no hay query param", async () => {
    const data = await loader(
      makeArgs("https://localhost/resubir-comprobante/7", "7"),
    );
    expect(data.requestId).toBe(7);
    expect(data.resubmit).toBe(true);
    expect(data.receiptToReplace).toBeNull();
  });
});
