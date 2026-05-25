/**
 * @module uploadReceiptFile
 * @description Use-cases puros (DI) para subir/borrar archivos de comprobante.
 * Paridad 1:1 con el legacy `receiptFileService.uploadReceiptFiles` /
 * `uploadInternationalReceiptImage` / `deleteReceiptFiles` + el controller
 * `deleteReceipt`:
 *   - valida que la solicitud permita subir comprobantes,
 *   - parsea el CFDI y verifica unicidad de UUID,
 *   - sube PDF+XML (o imagen internacional) a GridFS vía `FileStore`,
 *   - persiste los file IDs en el receipt.
 */
import type { FileStore, StoredFile } from "~/contexts/receipts-cfdi/domain/ports/FileStore.js";
import type { ReceiptFilesRepository } from "~/contexts/receipts-cfdi/domain/ports/ReceiptFilesRepository.js";
import {
  ReceiptNotFoundError,
  CfdiAlreadyExistsError,
} from "~/contexts/receipts-cfdi/domain/errors.js";

export type UploadedFile = { buffer: Buffer; fileName: string; contentType: string };

export type ParsedCfdi = { uuid: string };

export type UploadReceiptFileDeps = {
  fileStore: FileStore;
  receiptFiles: ReceiptFilesRepository;
  /** Lanza si la solicitud no admite subir comprobantes (status fuera de rango). */
  assertCanUpload: (requestId: number) => Promise<void>;
  parseCfdi: (xml: string) => ParsedCfdi;
  buildRegistroSugerido: (xml: string) => unknown;
};

export type UploadReceiptFileInput = {
  receiptId: number;
  pdf: UploadedFile;
  xml: UploadedFile;
};

export type UploadReceiptFileResult = {
  pdf: StoredFile;
  xml: StoredFile;
  cfdi: ParsedCfdi;
  registroSugerido: unknown;
};

async function resolveRequestId(
  receiptId: number,
  deps: Pick<UploadReceiptFileDeps, "receiptFiles" | "assertCanUpload">,
): Promise<number> {
  const row = await deps.receiptFiles.findRequestIdForReceipt(receiptId);
  if (!row?.requestId) {
    throw new ReceiptNotFoundError(
      `Receipt ${receiptId} not found or has no associated request`,
    );
  }
  await deps.assertCanUpload(row.requestId);
  return row.requestId;
}

export async function uploadReceiptFile(
  input: UploadReceiptFileInput,
  deps: UploadReceiptFileDeps,
): Promise<UploadReceiptFileResult> {
  await resolveRequestId(input.receiptId, deps);

  const xmlContent = input.xml.buffer.toString("utf-8");
  const cfdi = deps.parseCfdi(xmlContent);

  let registroSugerido: unknown = null;
  try {
    registroSugerido = deps.buildRegistroSugerido(xmlContent);
  } catch {
    registroSugerido = null;
  }

  const existing = await deps.receiptFiles.findReceiptIdByCfdiUuid(cfdi.uuid);
  if (existing) {
    throw new CfdiAlreadyExistsError(
      `El CFDI con UUID ${cfdi.uuid} ya está registrado en el comprobante #${existing}`,
    );
  }

  const pdf = await deps.fileStore.upload(
    input.pdf.buffer,
    input.pdf.fileName,
    input.pdf.contentType,
    { receiptId: input.receiptId, fileType: "pdf" },
  );
  const xml = await deps.fileStore.upload(
    input.xml.buffer,
    input.xml.fileName,
    input.xml.contentType,
    { receiptId: input.receiptId, fileType: "xml" },
  );

  await deps.receiptFiles.updateReceiptFiles(input.receiptId, {
    pdfFileId: pdf.fileId,
    pdfFileName: pdf.fileName,
    xmlFileId: xml.fileId,
    xmlFileName: xml.fileName,
  });

  return { pdf, xml, cfdi, registroSugerido };
}

export type UploadInternationalReceiptImageInput = {
  receiptId: number;
  image: UploadedFile;
};

export async function uploadInternationalReceiptImage(
  input: UploadInternationalReceiptImageInput,
  deps: Pick<UploadReceiptFileDeps, "fileStore" | "receiptFiles" | "assertCanUpload">,
): Promise<{ image: StoredFile }> {
  await resolveRequestId(input.receiptId, deps);

  const image = await deps.fileStore.upload(
    input.image.buffer,
    input.image.fileName,
    input.image.contentType,
    { receiptId: input.receiptId, fileType: "international_receipt" },
  );

  await deps.receiptFiles.updateReceiptFiles(input.receiptId, {
    pdfFileId: image.fileId,
    pdfFileName: image.fileName,
    xmlFileId: null,
    xmlFileName: null,
  });

  return { image };
}

export type DeleteReceiptFileDeps = Pick<
  UploadReceiptFileDeps,
  "fileStore" | "receiptFiles" | "assertCanUpload"
>;

export async function deleteReceiptFile(
  input: { receiptId: number },
  deps: DeleteReceiptFileDeps,
): Promise<{ receiptId: number }> {
  await resolveRequestId(input.receiptId, deps);

  const meta = await deps.receiptFiles.findReceiptFileIds(input.receiptId);
  if (meta?.pdfFileId) await deps.fileStore.remove(meta.pdfFileId);
  if (meta?.xmlFileId) await deps.fileStore.remove(meta.xmlFileId);

  await deps.receiptFiles.deleteReceipt(input.receiptId);
  return { receiptId: input.receiptId };
}
