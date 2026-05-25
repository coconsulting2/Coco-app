/**
 * @module ReceiptFilesRepository
 * @description Puerto para metadata de archivos de comprobante (GridFS file IDs
 * en Postgres) + chequeo de unicidad de UUID CFDI. El adapter Prisma vive en
 * `infrastructure/PrismaReceiptFilesRepository.ts`.
 */
export type ReceiptFilesMetadata = {
  pdfFileId: string | null;
  pdfFileName: string | null;
  xmlFileId: string | null;
  xmlFileName: string | null;
};

export interface ReceiptFilesRepository {
  /** Devuelve el requestId asociado al receipt (o null si no existe). */
  findRequestIdForReceipt(receiptId: number): Promise<{ requestId: number | null } | null>;
  /** receiptId que ya registró ese UUID CFDI, o null si está libre. */
  findReceiptIdByCfdiUuid(uuid: string): Promise<number | null>;
  /** Persiste los file IDs/nombres en el receipt. */
  updateReceiptFiles(receiptId: number, files: ReceiptFilesMetadata): Promise<void>;
  /** Metadata de archivos del receipt (para servirlos/borrarlos). */
  findReceiptFileIds(receiptId: number): Promise<ReceiptFilesMetadata | null>;
  /** Elimina la fila del receipt (al reemplazar un comprobante). */
  deleteReceipt(receiptId: number): Promise<void>;
}
