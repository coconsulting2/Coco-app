/**
 * @module PrismaReceiptFilesRepository
 * @description Adapter Prisma del port `ReceiptFilesRepository`. Reemplaza el
 * acceso directo legacy (receiptFileQueries + cfdiModel) con queries tipadas.
 */
import prisma from "~/platform/db/prisma.server.js";
import type {
  ReceiptFilesRepository,
  ReceiptFilesMetadata,
} from "~/contexts/receipts-cfdi/domain/ports/ReceiptFilesRepository.js";

export class PrismaReceiptFilesRepository implements ReceiptFilesRepository {
  async findRequestIdForReceipt(
    receiptId: number,
  ): Promise<{ requestId: number | null } | null> {
    return prisma.receipt.findUnique({
      where: { receiptId: Number(receiptId) },
      select: { requestId: true },
    });
  }

  async findReceiptIdByCfdiUuid(uuid: string): Promise<number | null> {
    const row = await prisma.cfdiComprobante.findUnique({
      where: { uuid },
      select: { receiptId: true },
    });
    return row?.receiptId ?? null;
  }

  async updateReceiptFiles(receiptId: number, files: ReceiptFilesMetadata): Promise<void> {
    await prisma.receipt.update({
      where: { receiptId: Number(receiptId) },
      data: files,
    });
  }

  async findReceiptFileIds(receiptId: number): Promise<ReceiptFilesMetadata | null> {
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

  async deleteReceipt(receiptId: number): Promise<void> {
    await prisma.receipt.delete({ where: { receiptId: Number(receiptId) } });
  }
}
