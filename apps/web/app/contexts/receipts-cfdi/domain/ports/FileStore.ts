/**
 * @module FileStore
 * @description Puerto de almacenamiento binario de archivos de comprobante
 * (GridFS en infraestructura). Los use-cases dependen de esta interfaz; el
 * adapter concreto (`GridFsFileStore`) vive en `infrastructure/`.
 */
import type { Readable } from "stream";

export type StoredFile = { fileId: string; fileName: string };

export interface FileStore {
  /** Sube un buffer y devuelve el id + nombre sanitizado del archivo. */
  upload(
    buffer: Buffer,
    fileName: string,
    contentType: string,
    metadata?: Record<string, unknown>,
  ): Promise<StoredFile>;
  /** Abre un stream de lectura del archivo. */
  getStream(fileId: string): Promise<Readable>;
  /** Elimina un archivo por id (no-throw si no existe). */
  remove(fileId: string): Promise<void>;
}
