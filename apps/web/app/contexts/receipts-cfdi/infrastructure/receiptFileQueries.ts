// @ts-nocheck — legacy CFDI logic; typed properly is M9 follow-up
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @module receiptFileQueries
 * @description Queries Prisma para metadata de archivos de receipt (GridFS file IDs).
 * Extracción Fase 6 desde receiptFileService (application/).
 */
import prisma from "~/platform/db/prisma.server.js";

/**
 * @param {number} receiptId
 * @returns {Promise<{ requestId: number | null } | null>}
 */
export async function findRequestIdForReceipt(receiptId: any) {
  return prisma.receipt.findUnique({
    where: { receiptId: Number(receiptId) },
    select: { requestId: true },
  });
}

/**
 * @param {number} receiptId
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function updateReceiptFiles(receiptId: any, data: any) {
  return prisma.receipt.update({
    where: { receiptId: Number(receiptId) },
    data,
  });
}

/**
 * @param {number} receiptId
 * @returns {Promise<object | null>}
 */
export async function findReceiptFileIds(receiptId: any) {
  return prisma.receipt.findUnique({
    where: { receiptId: Number(receiptId) },
    select: {
      pdfFileId: true,
      pdfFileName: true,
      xmlFileId: true,
      xmlFileName: true,
    },
  });
}

/**
 * Solo los IDs para borrar (sin metadata extra).
 * @param {number} receiptId
 * @returns {Promise<{ pdfFileId: string | null; xmlFileId: string | null } | null>}
 */
export async function findReceiptFileIdsForDelete(receiptId: any) {
  return prisma.receipt.findUnique({
    where: { receiptId: Number(receiptId) },
    select: { pdfFileId: true, xmlFileId: true },
  });
}
