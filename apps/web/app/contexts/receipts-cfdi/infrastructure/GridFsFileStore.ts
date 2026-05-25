/**
 * @module GridFsFileStore
 * @description Adapter del port `FileStore` sobre MongoDB GridFS
 * (`platform/mongo/gridfs.server`). Única frontera tipada con el helper `.js`.
 */
import { ObjectId } from "mongodb";
import type { Readable } from "stream";
import { uploadFile, getFile, bucket } from "~/platform/mongo/gridfs.server.js";
import type { FileStore, StoredFile } from "~/contexts/receipts-cfdi/domain/ports/FileStore.js";

export class GridFsFileStore implements FileStore {
  async upload(
    buffer: Buffer,
    fileName: string,
    contentType: string,
    metadata: Record<string, unknown> = {},
  ): Promise<StoredFile> {
    return uploadFile(buffer, fileName, contentType, metadata);
  }

  async getStream(fileId: string): Promise<Readable> {
    return getFile(fileId);
  }

  async remove(fileId: string): Promise<void> {
    try {
      await bucket.delete(new ObjectId(fileId));
    } catch {
      // Paridad legacy: borrar archivos es best-effort (no-throw si falta).
    }
  }
}
