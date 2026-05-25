/**
 * @module S3FileStore
 * @description Adapter del port `FileStore` sobre almacenamiento compatible S3
 * (AWS S3, Cloudflare R2 o MinIO local). Implementa la MISMA interfaz que
 * `GridFsFileStore`: `upload` → `PutObjectCommand`, `getStream` →
 * `GetObjectCommand`, `remove` → `DeleteObjectCommand` (best-effort, no-throw).
 *
 * Config por env:
 *  - `S3_ENDPOINT`          endpoint custom (MinIO/R2). Vacío para AWS S3 real.
 *  - `S3_REGION`            región (default `us-east-1`).
 *  - `S3_BUCKET`            bucket destino.
 *  - `S3_ACCESS_KEY_ID`     credencial.
 *  - `S3_SECRET_ACCESS_KEY` credencial.
 *  - `S3_FORCE_PATH_STYLE`  `true` para MinIO (path-style addressing).
 */
import { randomUUID } from "crypto";
import type { Readable } from "stream";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { Logger } from "~/platform/logger/log/logger.js";
import type { FileStore, StoredFile } from "~/contexts/receipts-cfdi/domain/ports/FileStore.js";

const log = Logger("s3-file-store");

export interface S3FileStoreConfig {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

/** Lee la config S3 del entorno. */
function configFromEnv(): S3FileStoreConfig {
  return {
    endpoint: process.env.S3_ENDPOINT || undefined,
    region: process.env.S3_REGION || "us-east-1",
    bucket: process.env.S3_BUCKET || "coco-receipts",
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    forcePathStyle: String(process.env.S3_FORCE_PATH_STYLE).toLowerCase() === "true",
  };
}

/** Sanitiza el nombre de archivo: paridad básica con el sanitize de GridFS. */
function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^\w.\-]+/g, "_");
}

export class S3FileStore implements FileStore {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(
    config: S3FileStoreConfig = configFromEnv(),
    client?: S3Client,
  ) {
    this.bucket = config.bucket;
    this.client =
      client ??
      new S3Client({
        region: config.region,
        endpoint: config.endpoint,
        forcePathStyle: config.forcePathStyle,
        credentials: config.accessKeyId
          ? {
              accessKeyId: config.accessKeyId,
              secretAccessKey: config.secretAccessKey,
            }
          : undefined,
      });
  }

  async upload(
    buffer: Buffer,
    fileName: string,
    contentType: string,
    metadata: Record<string, unknown> = {},
  ): Promise<StoredFile> {
    const sanitizedFileName = sanitizeFileName(fileName);
    // Key opaca + única (equivalente al ObjectId que devolvía GridFS) para
    // evitar colisiones; el nombre original se conserva en metadata.
    const fileId = randomUUID();
    // S3 metadata sólo admite strings; serializamos los valores.
    const stringMetadata: Record<string, string> = {
      filename: sanitizedFileName,
      uploaddate: new Date().toISOString(),
    };
    for (const [key, value] of Object.entries(metadata)) {
      stringMetadata[key.toLowerCase()] = String(value);
    }

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: fileId,
        Body: buffer,
        ContentType: contentType,
        Metadata: stringMetadata,
      }),
    );

    return { fileId, fileName: sanitizedFileName };
  }

  async getStream(fileId: string): Promise<Readable> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: fileId }),
    );
    // En runtime node el Body es siempre un stream.Readable.
    return result.Body as Readable;
  }

  async remove(fileId: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: fileId }),
      );
    } catch (error) {
      // Paridad legacy: borrar archivos es best-effort (no-throw si falta).
      log.warn({ err: error, fileId }, "S3 delete failed (ignored)");
    }
  }
}
