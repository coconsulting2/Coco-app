// @ts-nocheck — legacy CFDI logic; typed properly is M9 follow-up
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @module receiptFileService
 * @description Handles receipt file operations: uploading, retrieving, and
 * deleting PDF and XML files in MongoDB GridFS, with metadata stored in
 * PostgreSQL via Prisma. Validates and parses CFDI XML before storage; UUID
 * duplicado se valida contra cfdi_comprobantes.
 *
 * Refactor Fase 6: prisma extraído a receiptFileQueries.js.
 */
import { ObjectId } from "mongodb";
import { uploadFile, getFile, bucket } from "~/platform/mongo/gridfs.server.js";
import {
  parseCFDI,
  buildComprobanteRegistroBodyFromXml,
  CfdiParseError,
} from "./cfdiParserService.js";
import CfdiModel from "~/contexts/receipts-cfdi/infrastructure/cfdiModel.js";
import { assertRequestAllowsReceiptUpload } from "~/contexts/travel-requests/application/requestReceiptUploadPolicy.js";
import {
  findRequestIdForReceipt,
  updateReceiptFiles,
  findReceiptFileIds,
  findReceiptFileIdsForDelete,
} from "~/contexts/receipts-cfdi/infrastructure/receiptFileQueries.js";

export { CfdiParseError };

/**
 * Uploads a PDF and XML file pair for a receipt to MongoDB GridFS.
 *
 * @param {number} receiptId
 * @param {Express.Multer.File} pdfFile
 * @param {Express.Multer.File} xmlFile
 */
export async function uploadReceiptFiles(receiptId: any, pdfFile: any, xmlFile: any) {
  const receiptRow = await findRequestIdForReceipt(receiptId);
  if (!receiptRow?.requestId) {
    const err = new Error("Receipt not found or has no associated request");
    err.status = 404;
    throw err;
  }
  await assertRequestAllowsReceiptUpload(receiptRow.requestId);

  const xmlContent = xmlFile.buffer.toString("utf-8");
  const cfdiData = parseCFDI(xmlContent);

  let registroSugerido = null;
  try {
    registroSugerido = buildComprobanteRegistroBodyFromXml(xmlContent);
  } catch {
    registroSugerido = null;
  }

  const existing = await CfdiModel.findByCfdiUuid(cfdiData.uuid);
  if (existing) {
    const err = new Error(
      `El CFDI con UUID ${cfdiData.uuid} ya está registrado en el comprobante #${existing.receiptId}`,
    );
    err.code = "DUPLICATE_UUID";
    err.receiptId = existing.receiptId;
    throw err;
  }

  try {
    const pdfResult = await uploadFile(
      pdfFile.buffer,
      pdfFile.originalname,
      pdfFile.mimetype,
      { receiptId, fileType: "pdf" },
    );

    const xmlResult = await uploadFile(
      xmlFile.buffer,
      xmlFile.originalname,
      xmlFile.mimetype,
      { receiptId, fileType: "xml" },
    );

    await updateReceiptFiles(receiptId, {
      pdfFileId: pdfResult.fileId,
      pdfFileName: pdfResult.fileName,
      xmlFileId: xmlResult.fileId,
      xmlFileName: xmlResult.fileName,
    });

    return { pdf: pdfResult, xml: xmlResult, cfdi: cfdiData, registroSugerido };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error uploading receipt files:", error);
    throw error;
  }
}

/**
 * Sube imagen JPG/PNG como comprobante internacional (sin XML ni CFDI).
 *
 * @param {number} receiptId
 * @param {Express.Multer.File} imageFile
 */
export async function uploadInternationalReceiptImage(receiptId: any, imageFile: any) {
  const receiptRow = await findRequestIdForReceipt(receiptId);
  if (!receiptRow?.requestId) {
    const err = new Error("Receipt not found or has no associated request");
    err.status = 404;
    throw err;
  }
  await assertRequestAllowsReceiptUpload(receiptRow.requestId);

  const imageResult = await uploadFile(
    imageFile.buffer,
    imageFile.originalname,
    imageFile.mimetype,
    { receiptId, fileType: "international_receipt" },
  );

  await updateReceiptFiles(receiptId, {
    pdfFileId: imageResult.fileId,
    pdfFileName: imageResult.fileName,
    xmlFileId: null,
    xmlFileName: null,
  });

  return { image: imageResult };
}

/**
 * @param {import('mongodb').ObjectId} fileId
 */
export async function getReceiptFile(fileId: any) {
  try {
    return await getFile(fileId);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error getting receipt file:", error);
    throw error;
  }
}

/**
 * @param {number} receiptId
 */
export async function getReceiptFilesMetadata(receiptId: any) {
  const receipt = await findReceiptFileIds(receiptId);
  if (!receipt) {
    throw new Error("Receipt not found");
  }
  return {
    pdf: { fileId: receipt.pdfFileId, fileName: receipt.pdfFileName },
    xml: { fileId: receipt.xmlFileId, fileName: receipt.xmlFileName },
  };
}

/**
 * @param {number} receiptId
 */
export async function deleteReceiptFiles(receiptId: any) {
  const receipt = await findReceiptFileIdsForDelete(receiptId);
  if (!receipt) {
    throw new Error("Receipt not found");
  }

  if (receipt.pdfFileId) {
    try {
      await bucket.delete(new ObjectId(receipt.pdfFileId));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Error deleting PDF file ${receipt.pdfFileId}:`, error);
    }
  }

  if (receipt.xmlFileId) {
    try {
      await bucket.delete(new ObjectId(receipt.xmlFileId));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Error deleting XML file ${receipt.xmlFileId}:`, error);
    }
  }

  return true;
}
