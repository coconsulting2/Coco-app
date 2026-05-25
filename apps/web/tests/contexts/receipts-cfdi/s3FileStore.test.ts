/**
 * Unit tests del adapter `S3FileStore`: verifica que upload/getStream/remove
 * mapean a los comandos S3 correctos. El cliente S3 se stubea (mock de
 * `@aws-sdk/client-s3` con `send` espiado). Logger mockeado.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("~/platform/logger/log/logger.js", () => ({
  Logger: () => ({ info() {}, warn() {}, error() {}, trace() {}, debug() {} }),
}));

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock("@aws-sdk/client-s3", () => {
  // Comandos stubeados: capturan su input para inspección. Definidos dentro
  // de la factory porque `vi.mock` se iza al tope del archivo.
  class FakeCommand {
    constructor(public readonly input: Record<string, unknown>) {}
  }
  return {
    S3Client: class {
      send = sendMock;
    },
    PutObjectCommand: class extends FakeCommand {},
    GetObjectCommand: class extends FakeCommand {},
    DeleteObjectCommand: class extends FakeCommand {},
  };
});

import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { S3FileStore } from "~/contexts/receipts-cfdi/infrastructure/S3FileStore";
import type { S3FileStoreConfig } from "~/contexts/receipts-cfdi/infrastructure/S3FileStore";

const config: S3FileStoreConfig = {
  endpoint: "http://localhost:9000",
  region: "us-east-1",
  bucket: "test-bucket",
  accessKeyId: "key",
  secretAccessKey: "secret",
  forcePathStyle: true,
};

function store() {
  return new S3FileStore(config);
}

/** Forma de los comandos stubeados (capturan su `input`). */
type CapturedCommand = { input: Record<string, unknown> };
function captured(callIndex = 0): CapturedCommand {
  return sendMock.mock.calls[callIndex][0] as unknown as CapturedCommand;
}

describe("S3FileStore", () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({});
  });

  it("upload mapea a PutObjectCommand con bucket, body y content-type", async () => {
    const result = await store().upload(
      Buffer.from("hello"),
      "factura.pdf",
      "application/pdf",
      { receiptId: 5 },
    );

    expect(sendMock).toHaveBeenCalledOnce();
    const cmd = captured();
    expect(cmd).toBeInstanceOf(PutObjectCommand);
    expect(cmd.input.Bucket).toBe("test-bucket");
    expect(cmd.input.ContentType).toBe("application/pdf");
    expect((cmd.input.Body as Buffer).toString()).toBe("hello");
    // metadata serializada a strings + nombre original conservado.
    const metadata = cmd.input.Metadata as Record<string, string>;
    expect(metadata.filename).toBe("factura.pdf");
    expect(metadata.receiptid).toBe("5");
    // fileId opaco/único usado como Key.
    expect(cmd.input.Key).toBe(result.fileId);
    expect(result.fileName).toBe("factura.pdf");
  });

  it("upload sanitiza el nombre de archivo", async () => {
    const result = await store().upload(
      Buffer.from("x"),
      "mi factura rara!.pdf",
      "application/pdf",
    );
    expect(result.fileName).toBe("mi_factura_rara_.pdf");
  });

  it("getStream mapea a GetObjectCommand y devuelve el Body", async () => {
    const fakeStream = { pipe: () => {} };
    sendMock.mockResolvedValue({ Body: fakeStream });

    const stream = await store().getStream("file-123");

    const cmd = captured();
    expect(cmd).toBeInstanceOf(GetObjectCommand);
    expect(cmd.input.Bucket).toBe("test-bucket");
    expect(cmd.input.Key).toBe("file-123");
    expect(stream).toBe(fakeStream);
  });

  it("remove mapea a DeleteObjectCommand", async () => {
    await store().remove("file-456");

    const cmd = captured();
    expect(cmd).toBeInstanceOf(DeleteObjectCommand);
    expect(cmd.input.Bucket).toBe("test-bucket");
    expect(cmd.input.Key).toBe("file-456");
  });

  it("remove es best-effort: no lanza si el delete falla", async () => {
    sendMock.mockRejectedValue(new Error("not found"));
    await expect(store().remove("missing")).resolves.toBeUndefined();
  });
});
