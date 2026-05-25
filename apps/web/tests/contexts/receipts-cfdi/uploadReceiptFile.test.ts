/**
 * Unit tests de los use-cases de archivos de comprobante con stubs in-memory
 * de `FileStore` + `ReceiptFilesRepository` — sin GridFS ni DB.
 */
import { describe, it, expect, vi } from "vitest";
import {
  uploadReceiptFile,
  deleteReceiptFile,
  type UploadReceiptFileDeps,
} from "~/contexts/receipts-cfdi/application/uploadReceiptFile";
import type { FileStore } from "~/contexts/receipts-cfdi/domain/ports/FileStore";
import type { ReceiptFilesRepository } from "~/contexts/receipts-cfdi/domain/ports/ReceiptFilesRepository";
import {
  ReceiptNotFoundError,
  CfdiAlreadyExistsError,
} from "~/contexts/receipts-cfdi/domain/errors";

function fileStore(): FileStore {
  return {
    upload: vi.fn(async (_b, fileName) => ({ fileId: `id-${fileName}`, fileName })),
    getStream: vi.fn(),
    remove: vi.fn(async () => {}),
  };
}

function repo(overrides: Partial<ReceiptFilesRepository> = {}): ReceiptFilesRepository {
  return {
    findRequestIdForReceipt: async () => ({ requestId: 7 }),
    findReceiptIdByCfdiUuid: async () => null,
    updateReceiptFiles: vi.fn(async () => {}),
    findReceiptFileIds: async () => ({
      pdfFileId: "pdf1",
      pdfFileName: "a.pdf",
      xmlFileId: "xml1",
      xmlFileName: "a.xml",
    }),
    deleteReceipt: vi.fn(async () => {}),
    ...overrides,
  };
}

function deps(over: Partial<UploadReceiptFileDeps> = {}): UploadReceiptFileDeps {
  return {
    fileStore: fileStore(),
    receiptFiles: repo(),
    assertCanUpload: vi.fn(async () => {}),
    parseCfdi: () => ({ uuid: "UUID-1" }),
    buildRegistroSugerido: () => ({ total: 100 }),
    ...over,
  };
}

const file = (name: string) => ({ buffer: Buffer.from("x"), fileName: name, contentType: "application/pdf" });

describe("uploadReceiptFile", () => {
  it("lanza ReceiptNotFoundError si el receipt no tiene requestId", async () => {
    await expect(
      uploadReceiptFile(
        { receiptId: 1, pdf: file("a.pdf"), xml: file("a.xml") },
        deps({ receiptFiles: repo({ findRequestIdForReceipt: async () => null }) }),
      ),
    ).rejects.toBeInstanceOf(ReceiptNotFoundError);
  });

  it("lanza CfdiAlreadyExistsError si el UUID ya existe", async () => {
    await expect(
      uploadReceiptFile(
        { receiptId: 1, pdf: file("a.pdf"), xml: file("a.xml") },
        deps({ receiptFiles: repo({ findReceiptIdByCfdiUuid: async () => 99 }) }),
      ),
    ).rejects.toBeInstanceOf(CfdiAlreadyExistsError);
  });

  it("sube PDF+XML y persiste los file IDs en el happy path", async () => {
    const r = repo();
    const fs = fileStore();
    const result = await uploadReceiptFile(
      { receiptId: 5, pdf: file("a.pdf"), xml: file("a.xml") },
      deps({ receiptFiles: r, fileStore: fs }),
    );
    expect(fs.upload).toHaveBeenCalledTimes(2);
    expect(r.updateReceiptFiles).toHaveBeenCalledOnce();
    expect(result.cfdi.uuid).toBe("UUID-1");
  });
});

describe("deleteReceiptFile", () => {
  it("borra archivos de GridFS y la fila del receipt", async () => {
    const r = repo();
    const fs = fileStore();
    const result = await deleteReceiptFile(
      { receiptId: 5 },
      { fileStore: fs, receiptFiles: r, assertCanUpload: vi.fn(async () => {}) },
    );
    expect(fs.remove).toHaveBeenCalledTimes(2);
    expect(r.deleteReceipt).toHaveBeenCalledOnce();
    expect(result.receiptId).toBe(5);
  });
});
