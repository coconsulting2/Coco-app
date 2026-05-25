/**
 * Unit test del use-case `getAccountingPolizasInRange` con stub in-memory del
 * port `AccountingExportQueries` — sin DB. Cubre:
 *  - `from` ausente/ inválido → InvalidAccountingDataError (400)
 *  - `to` inválido → InvalidAccountingDataError
 *  - `from` > `to` → InvalidAccountingDataError
 *  - `to` por defecto = ahora cuando se omite
 *  - delega al port con las fechas parseadas y `force`, y proyecta `{ polizas, from, to }`
 */
import { describe, it, expect, vi } from "vitest";

// El use-case no importa el logger transitivamente, pero el mock es defensivo
// frente a futuros wirings vía slice index.
vi.mock("~/platform/logger/log/logger.js", () => ({
  Logger: () => ({ info() {}, warn() {}, error() {}, trace() {}, debug() {} }),
}));

import { getAccountingPolizasInRange } from "~/contexts/accounts-payable/application/getAccountingPolizasInRange";
import { InvalidAccountingDataError } from "~/contexts/accounts-payable/domain/errors";
import type { AccountingExportQueries } from "~/contexts/accounts-payable/domain/ports/AccountingExportQueries";
import type { AccountingPoliza } from "~/contexts/accounts-payable/domain/entities/AccountingPoliza";

function samplePoliza(idViaje: string): AccountingPoliza {
  return {
    header: {
      ID_VIAJE: idViaje,
      DOC_TYPE: "GV",
      HEADER_TXT: `Gasto Viaje # ${idViaje}`,
      COMP_CODE: "1000",
      PSTNG_DATE: "2026-05-10",
      CURRENCY: "MXN",
      EXCH_RATE: 1,
    },
    detalle: [
      {
        ITEMNO_ACC: 1,
        SHKZG: "S",
        GL_ACCOUNT: "600100",
        ITEM_TEXT: "Gasto",
        AMT_DOCCUR: 100,
        COSTCENTER: "CC01",
      },
      { ITEMNO_ACC: 2, SHKZG: "H", GL_ACCOUNT: "210100", ITEM_TEXT: "CxP", AMT_DOCCUR: 100 },
    ],
  };
}

type Recorded = { from: Date; to: Date; force: boolean | undefined };

function stubQueries(
  result: AccountingPoliza[],
  calls: Recorded[],
): AccountingExportQueries {
  return {
    getPolizasInRange: async (from, to, options) => {
      calls.push({ from, to, force: options?.force });
      return result;
    },
  };
}

describe("getAccountingPolizasInRange", () => {
  it("lanza InvalidAccountingDataError (400) si 'from' falta", async () => {
    const calls: Recorded[] = [];
    await expect(
      getAccountingPolizasInRange({ from: "" }, { exportQueries: stubQueries([], calls) }),
    ).rejects.toMatchObject({ status: 400 });
    expect(calls).toHaveLength(0);
  });

  it("lanza InvalidAccountingDataError si 'from' es inválido", async () => {
    await expect(
      getAccountingPolizasInRange(
        { from: "no-es-fecha" },
        { exportQueries: stubQueries([], []) },
      ),
    ).rejects.toBeInstanceOf(InvalidAccountingDataError);
  });

  it("lanza InvalidAccountingDataError si 'to' es inválido", async () => {
    await expect(
      getAccountingPolizasInRange(
        { from: "2026-05-01", to: "xx" },
        { exportQueries: stubQueries([], []) },
      ),
    ).rejects.toBeInstanceOf(InvalidAccountingDataError);
  });

  it("lanza InvalidAccountingDataError si 'from' > 'to'", async () => {
    await expect(
      getAccountingPolizasInRange(
        { from: "2026-05-20", to: "2026-05-01" },
        { exportQueries: stubQueries([], []) },
      ),
    ).rejects.toBeInstanceOf(InvalidAccountingDataError);
  });

  it("usa 'now' como 'to' por defecto cuando se omite", async () => {
    const calls: Recorded[] = [];
    const before = Date.now();
    await getAccountingPolizasInRange(
      { from: "2026-05-01" },
      { exportQueries: stubQueries([], calls) },
    );
    const after = Date.now();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.to.getTime()).toBeGreaterThanOrEqual(before);
    expect(calls[0]!.to.getTime()).toBeLessThanOrEqual(after);
  });

  it("delega al port con fechas + force y proyecta { polizas, from, to }", async () => {
    const calls: Recorded[] = [];
    const polizas = [samplePoliza("101"), samplePoliza("102")];
    const result = await getAccountingPolizasInRange(
      { from: "2026-05-01", to: "2026-05-15", force: true },
      { exportQueries: stubQueries(polizas, calls) },
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]!.force).toBe(true);
    expect(calls[0]!.from.toISOString().slice(0, 10)).toBe("2026-05-01");
    expect(calls[0]!.to.toISOString().slice(0, 10)).toBe("2026-05-15");
    expect(result.polizas).toHaveLength(2);
    expect(result.from).toBe("2026-05-01");
    expect(result.to).toBe("2026-05-15");
    expect(result.polizas[0]!.header.ID_VIAJE).toBe("101");
  });

  it("default force=false cuando no se especifica", async () => {
    const calls: Recorded[] = [];
    await getAccountingPolizasInRange(
      { from: "2026-05-01", to: "2026-05-15" },
      { exportQueries: stubQueries([], calls) },
    );
    expect(calls[0]!.force).toBe(false);
  });
});
