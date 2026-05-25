/**
 * @module ComprobantesRepository
 * @description Puerto del slice receipts-cfdi para persistir/consultar CFDI
 * comprobantes (registro nacional + internacional). El adapter por defecto
 * vive en `infrastructure/PrismaComprobantesRepository.ts`.
 */
import type { CreateCfdiData } from "~/contexts/receipts-cfdi/infrastructure/comprobantesModel.js";

/** Vista mínima del Receipt que necesitan los use-cases de registro. */
export type ReceiptForRegister = {
  receiptId: number;
  requestId: number | null;
  organizationId: bigint;
};

/** CFDI ya persistido (subconjunto consultado para reglas de unicidad). */
export type ExistingCfdi = {
  cfdiId: number;
  uuid: string;
};

export type UpsertInternationalArgs = {
  receiptId: number;
  receiptUpdate: Record<string, unknown>;
  cfdiData: Record<string, unknown>;
};

export interface ComprobantesRepository {
  /** Busca el Receipt por id (null si no existe). */
  findReceiptById(receiptId: number): Promise<ReceiptForRegister | null>;
  /** Busca un CFDI por UUID (null si libre). Enforce de unicidad. */
  findByUuid(uuid: string): Promise<ExistingCfdi | null>;
  /** Busca el CFDI ligado a un recibo (null si aún no tiene). */
  findCfdiByReceiptId(receiptId: number): Promise<ExistingCfdi | null>;
  /** Inserta el CFDI nacional atómicamente. Devuelve el cfdiId creado. */
  createCfdi(receiptId: number, data: CreateCfdiData): Promise<{ cfdiId: number }>;
  /** Actualiza Receipt + crea CFDI internacional atómicamente. */
  upsertReceiptWithCfdi(args: UpsertInternationalArgs): Promise<{ cfdiId: number }>;
  /** Último estado SAT almacenado del CFDI ligado al recibo. */
  getSatValidationByReceiptId(
    receiptId: number,
  ): Promise<{ satEstado: string; createdAt: Date } | null>;
}
