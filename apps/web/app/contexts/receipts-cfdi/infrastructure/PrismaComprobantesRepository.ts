/**
 * @module PrismaComprobantesRepository
 * @description Adapter Prisma del puerto `ComprobantesRepository`. Envuelve
 * `comprobantesModel` (CRUD CFDI) + `comprobantesQueries` (transacción
 * internacional) con un shape tipado para los use-cases de registro.
 */
import ComprobantesModel, {
  type CreateCfdiData,
} from "~/contexts/receipts-cfdi/infrastructure/comprobantesModel.js";
import {
  findCfdiByReceiptId,
  upsertReceiptWithCfdiTx,
} from "~/contexts/receipts-cfdi/infrastructure/comprobantesQueries.js";
import type {
  ComprobantesRepository,
  ExistingCfdi,
  ReceiptForRegister,
  UpsertInternationalArgs,
} from "~/contexts/receipts-cfdi/domain/ports/ComprobantesRepository.js";

export class PrismaComprobantesRepository implements ComprobantesRepository {
  async findReceiptById(receiptId: number): Promise<ReceiptForRegister | null> {
    const receipt = await ComprobantesModel.findReceiptById(receiptId);
    if (!receipt) return null;
    return {
      receiptId: receipt.receiptId,
      requestId: receipt.requestId ?? null,
      organizationId: receipt.organizationId,
    };
  }

  async findByUuid(uuid: string): Promise<ExistingCfdi | null> {
    const row = await ComprobantesModel.findByUUID(uuid);
    if (!row) return null;
    return { cfdiId: row.cfdiId, uuid: row.uuid };
  }

  async findCfdiByReceiptId(receiptId: number): Promise<ExistingCfdi | null> {
    const row = await findCfdiByReceiptId(receiptId);
    if (!row) return null;
    return { cfdiId: row.cfdiId, uuid: row.uuid };
  }

  async createCfdi(
    receiptId: number,
    data: CreateCfdiData,
  ): Promise<{ cfdiId: number }> {
    const row = await ComprobantesModel.createCfdi(receiptId, data);
    return { cfdiId: row.cfdiId };
  }

  async upsertReceiptWithCfdi(
    args: UpsertInternationalArgs,
  ): Promise<{ cfdiId: number }> {
    const row = await upsertReceiptWithCfdiTx({
      receiptId: args.receiptId,
      receiptUpdate: args.receiptUpdate,
      cfdiData: args.cfdiData,
    });
    return { cfdiId: row.cfdiId };
  }

  async getSatValidationByReceiptId(
    receiptId: number,
  ): Promise<{ satEstado: string; createdAt: Date } | null> {
    return ComprobantesModel.getSatValidationByReceiptId(receiptId);
  }
}
