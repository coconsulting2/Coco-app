/**
 * @module receipts-cfdi (slice public API + parcial composition root)
 * @description Sólo `validateCfdiUpload` está hexagonal proper. El resto
 * del slice (insertarCfdi, uploadReceiptFiles, parseCFDI, etc.) sigue en
 * `.js` legacy — pendiente refactor completo (ver CLEANUP_PLAN.md).
 */

// ── Domain types + errores ────────────────────────────────────────────────
export type { Receipt } from "~/contexts/receipts-cfdi/domain/entities/Receipt.js";
export type { ReceiptRepository } from "~/contexts/receipts-cfdi/domain/ports/ReceiptRepository.js";
export type { CfdiRepository } from "~/contexts/receipts-cfdi/domain/ports/CfdiRepository.js";
export type { FileStore } from "~/contexts/receipts-cfdi/domain/ports/FileStore.js";
export type {
  CfdiValidator,
  CfdiValidationInput,
  CfdiValidationResult,
} from "~/contexts/receipts-cfdi/domain/ports/CfdiValidator.js";

export {
  ReceiptsCfdiError,
  ReceiptNotFoundError,
  CfdiAlreadyExistsError,
  InvalidCfdiXmlError,
} from "~/contexts/receipts-cfdi/domain/errors.js";

// ── Composition root: use-cases hexagonales ──────────────────────────────
import { SatCfdiValidator } from "~/contexts/receipts-cfdi/infrastructure/SatCfdiValidator.js";
import { PrismaReceiptValidationRepository } from "~/contexts/receipts-cfdi/infrastructure/PrismaReceiptValidationRepository.js";
import { PrismaCfdiAcuseWriter } from "~/contexts/receipts-cfdi/infrastructure/PrismaCfdiAcuseWriter.js";
import { WorkflowCommentsService } from "~/contexts/receipts-cfdi/infrastructure/WorkflowCommentsService.js";
import { RefundsExpenseDeadlineChecker } from "~/contexts/receipts-cfdi/infrastructure/RefundsExpenseDeadlineChecker.js";
import { AccountsPayableLifecycleSyncer } from "~/contexts/receipts-cfdi/infrastructure/AccountsPayableLifecycleSyncer.js";
import * as validateCfdiUploadModule from "~/contexts/receipts-cfdi/application/validateCfdiUpload.js";
import * as validateReceiptDecisionModule from "~/contexts/receipts-cfdi/application/validateReceiptDecision.js";
import * as getReceiptsForRequestValidationModule from "~/contexts/receipts-cfdi/application/getReceiptsForRequestValidation.js";
import * as uploadReceiptFileModule from "~/contexts/receipts-cfdi/application/uploadReceiptFile.js";
import * as registerReceiptCfdiModule from "~/contexts/receipts-cfdi/application/registerReceiptCfdi.js";
import * as registerInternationalReceiptModule from "~/contexts/receipts-cfdi/application/registerInternationalReceipt.js";
import { GridFsFileStore } from "~/contexts/receipts-cfdi/infrastructure/GridFsFileStore.js";
import { S3FileStore } from "~/contexts/receipts-cfdi/infrastructure/S3FileStore.js";
import type { FileStore } from "~/contexts/receipts-cfdi/domain/ports/FileStore.js";
import { PrismaReceiptFilesRepository } from "~/contexts/receipts-cfdi/infrastructure/PrismaReceiptFilesRepository.js";
import { PrismaComprobantesRepository } from "~/contexts/receipts-cfdi/infrastructure/PrismaComprobantesRepository.js";
import { ReceiptNotFoundError } from "~/contexts/receipts-cfdi/domain/errors.js";
import {
  parseCFDI,
  buildComprobanteRegistroBodyFromXml,
  selloUltimos8FromSello,
} from "~/contexts/receipts-cfdi/application/cfdiParserService.js";
import { assertRequestAllowsReceiptUpload } from "~/contexts/travel-requests";

const defaultValidator = new SatCfdiValidator();
const defaultReceiptValidationRepo = new PrismaReceiptValidationRepository();
const defaultCfdiAcuseWriter = new PrismaCfdiAcuseWriter();
const defaultCommentsService = new WorkflowCommentsService();
const defaultDeadlineChecker = new RefundsExpenseDeadlineChecker();
const defaultLifecycleSyncer = new AccountsPayableLifecycleSyncer();
// ── Selección de adapter de almacenamiento por env ───────────────────────
// `FILE_STORE_DRIVER`: `s3` (AWS/R2/MinIO) | `gridfs` (default, no rompe).
function buildFileStore(): FileStore {
  const driver = (process.env.FILE_STORE_DRIVER || "gridfs").toLowerCase();
  return driver === "s3" ? new S3FileStore() : new GridFsFileStore();
}

const defaultFileStore: FileStore = buildFileStore();
const defaultReceiptFilesRepo = new PrismaReceiptFilesRepository();
const defaultComprobantesRepo = new PrismaComprobantesRepository();

const uploadDeps = {
  fileStore: defaultFileStore,
  receiptFiles: defaultReceiptFilesRepo,
  assertCanUpload: (requestId: number) => assertRequestAllowsReceiptUpload(requestId),
  parseCfdi: parseCFDI,
  buildRegistroSugerido: buildComprobanteRegistroBodyFromXml,
};

export const validateCfdiUpload = (
  input: validateCfdiUploadModule.ValidateCfdiUploadInput,
) =>
  validateCfdiUploadModule.validateCfdiUpload(input, {
    validator: defaultValidator,
  });

export const validateReceiptDecision = (
  input: validateReceiptDecisionModule.ValidateReceiptDecisionInput,
) =>
  validateReceiptDecisionModule.validateReceiptDecision(input, {
    receipts: defaultReceiptValidationRepo,
    cfdiValidator: defaultValidator,
    cfdiAcuse: defaultCfdiAcuseWriter,
    comments: defaultCommentsService,
    deadline: defaultDeadlineChecker,
    lifecycle: defaultLifecycleSyncer,
  });

export const getReceiptsForRequestValidation = (
  input: getReceiptsForRequestValidationModule.GetReceiptsForRequestValidationInput,
) =>
  getReceiptsForRequestValidationModule.getReceiptsForRequestValidation(input, {
    receipts: defaultReceiptValidationRepo,
  });

// ── Upload/serve/delete de archivos de comprobante (FileStore + GridFS) ──
export const uploadReceiptFile = (
  input: uploadReceiptFileModule.UploadReceiptFileInput,
) => uploadReceiptFileModule.uploadReceiptFile(input, uploadDeps);

export const uploadInternationalReceiptImage = (
  input: uploadReceiptFileModule.UploadInternationalReceiptImageInput,
) => uploadReceiptFileModule.uploadInternationalReceiptImage(input, uploadDeps);

export const deleteReceiptFile = (input: { receiptId: number }) =>
  uploadReceiptFileModule.deleteReceiptFile(input, uploadDeps);

/** Stream del archivo (servido por el dispatcher /api/files — contrato KEPT). */
export const getReceiptFile = (fileId: string) => defaultFileStore.getStream(fileId);

/** Metadata {pdf,xml} de los archivos de un receipt. */
export const getReceiptFilesMetadata = async (receiptId: number) => {
  const meta = await defaultReceiptFilesRepo.findReceiptFileIds(receiptId);
  if (!meta) throw new ReceiptNotFoundError(`Receipt ${receiptId} not found`);
  return {
    pdf: { fileId: meta.pdfFileId, fileName: meta.pdfFileName },
    xml: { fileId: meta.xmlFileId, fileName: meta.xmlFileName },
  };
};

export type {
  UploadReceiptFileInput,
  UploadReceiptFileResult,
  UploadedFile,
} from "~/contexts/receipts-cfdi/application/uploadReceiptFile.js";
export type { ReceiptFilesRepository } from "~/contexts/receipts-cfdi/domain/ports/ReceiptFilesRepository.js";

// ── Register de comprobante CFDI (nacional + internacional) ──────────────
export const registerReceiptCfdi = (
  input: registerReceiptCfdiModule.RegisterReceiptCfdiInput,
) =>
  registerReceiptCfdiModule.registerReceiptCfdi(input, {
    repo: defaultComprobantesRepo,
    sat: defaultValidator,
    assertCanUpload: (requestId: number) => assertRequestAllowsReceiptUpload(requestId),
    selloUltimos8: selloUltimos8FromSello,
  });

export const registerInternationalReceipt = (
  input: registerInternationalReceiptModule.RegisterInternationalReceiptInput,
) =>
  registerInternationalReceiptModule.registerInternationalReceipt(input, {
    repo: defaultComprobantesRepo,
    assertCanUpload: (requestId: number) => assertRequestAllowsReceiptUpload(requestId),
  });

export type {
  RegisterReceiptCfdiInput,
  RegisterReceiptCfdiResult,
} from "~/contexts/receipts-cfdi/application/registerReceiptCfdi.js";
export type {
  RegisterInternationalReceiptInput,
  RegisterInternationalReceiptResult,
} from "~/contexts/receipts-cfdi/application/registerInternationalReceipt.js";
export type { ComprobantesRepository } from "~/contexts/receipts-cfdi/domain/ports/ComprobantesRepository.js";

/** Última validación SAT almacenada del CFDI ligado a un recibo (badge CxP). */
export const getReceiptSatValidation = (receiptId: number) =>
  defaultComprobantesRepo.getSatValidationByReceiptId(receiptId);

export type {
  ValidateCfdiUploadInput,
  ValidateCfdiUploadResult,
  CfdiVerdict,
} from "~/contexts/receipts-cfdi/application/validateCfdiUpload.js";

export type {
  ValidateReceiptDecisionInput,
  ValidateReceiptDecisionResult,
  ValidateReceiptDecisionDeps,
} from "~/contexts/receipts-cfdi/application/validateReceiptDecision.js";

export type {
  GetReceiptsForRequestValidationInput,
  GetReceiptsForRequestValidationDeps,
} from "~/contexts/receipts-cfdi/application/getReceiptsForRequestValidation.js";

export type {
  ReceiptValidationStatus,
  ReceiptDecision,
  ReceiptForValidation,
  ReceiptCfdiComprobante,
  ReceiptValidationListItem,
  ReceiptValidationListItemCfdi,
  RequestReceiptsForValidation,
} from "~/contexts/receipts-cfdi/domain/entities/ReceiptValidation.js";

export type { ReceiptValidationRepository } from "~/contexts/receipts-cfdi/domain/ports/ReceiptValidationRepository.js";
export type { CfdiAcuseWriter } from "~/contexts/receipts-cfdi/domain/ports/CfdiAcuseWriter.js";
export type {
  CommentsService,
  PostRequestCommentInput,
  PostRequestCommentResult,
} from "~/contexts/receipts-cfdi/domain/ports/CommentsService.js";
export type { ExpenseDeadlineChecker } from "~/contexts/receipts-cfdi/domain/ports/ExpenseDeadlineChecker.js";
export type {
  ReceiptsLifecycleSyncer,
  SyncRequestStatusResult,
} from "~/contexts/receipts-cfdi/domain/ports/ReceiptsLifecycleSyncer.js";

export {
  InvalidDecisionError,
  CommentRequiredError,
  ReceiptAlreadyDecidedError,
  ReceiptDeadlinePassedError,
  ReceiptMissingCfdiError,
  SatRejectedError,
  EfosBlacklistedError,
  ReceiptValidationPersistError,
} from "~/contexts/receipts-cfdi/domain/errors.js";

export const usecases = {
  validateCfdiUpload: validateCfdiUploadModule.validateCfdiUpload,
  validateReceiptDecision: validateReceiptDecisionModule.validateReceiptDecision,
  getReceiptsForRequestValidation: getReceiptsForRequestValidationModule.getReceiptsForRequestValidation,
} as const;

export const adapters = {
  CfdiValidator: SatCfdiValidator,
  ReceiptValidationRepository: PrismaReceiptValidationRepository,
  CfdiAcuseWriter: PrismaCfdiAcuseWriter,
  CommentsService: WorkflowCommentsService,
  ExpenseDeadlineChecker: RefundsExpenseDeadlineChecker,
  ReceiptsLifecycleSyncer: AccountsPayableLifecycleSyncer,
} as const;

// ── Re-exports legacy (.js sin hexagonal refactor) ───────────────────────
// Sólo los símbolos que realmente exporta cada módulo. Las declaraciones
// ambient viven en `apps/web/app/types/legacy-js.d.ts` — esta sección
// no requiere supresión local de tipos.
export {
  parseCFDI,
  buildComprobanteRegistroBodyFromXml,
  selloUltimos8FromSello,
  extractTaxes,
  CfdiParseError,
} from "~/contexts/receipts-cfdi/application/cfdiParserService.js";
export { findByCfdiUuid } from "~/contexts/receipts-cfdi/application/cfdiQueryService.js";
