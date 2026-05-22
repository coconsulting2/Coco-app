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

// ── Composition root: use-case hexagonal `validateCfdiUpload` ────────────
import { SatCfdiValidator } from "~/contexts/receipts-cfdi/infrastructure/SatCfdiValidator.js";
import * as validateCfdiUploadModule from "~/contexts/receipts-cfdi/application/validateCfdiUpload.js";

const defaultValidator = new SatCfdiValidator();

export const validateCfdiUpload = (
  input: validateCfdiUploadModule.ValidateCfdiUploadInput,
) =>
  validateCfdiUploadModule.validateCfdiUpload(input, {
    validator: defaultValidator,
  });

export type {
  ValidateCfdiUploadInput,
  ValidateCfdiUploadResult,
  CfdiVerdict,
} from "~/contexts/receipts-cfdi/application/validateCfdiUpload.js";

export const usecases = {
  validateCfdiUpload: validateCfdiUploadModule.validateCfdiUpload,
} as const;

export const adapters = {
  CfdiValidator: SatCfdiValidator,
} as const;

// ── Re-exports legacy (.js sin hexagonal refactor) ───────────────────────
// Sólo los símbolos que realmente exporta cada módulo. Las declaraciones
// ambient viven en `apps/web/app/types/legacy-js.d.ts` — esta sección
// no requiere supresión local de tipos.
export { insertarCfdi, insertarComprobanteInternacional } from "~/contexts/receipts-cfdi/application/comprobantesService.js";
export {
  uploadReceiptFiles,
  uploadInternationalReceiptImage,
  getReceiptFile,
  getReceiptFilesMetadata,
  deleteReceiptFiles,
} from "~/contexts/receipts-cfdi/application/receiptFileService.js";
export {
  parseCFDI,
  buildComprobanteRegistroBodyFromXml,
  selloUltimos8FromSello,
  extractTaxes,
  CfdiParseError,
} from "~/contexts/receipts-cfdi/application/cfdiParserService.js";
export { findByCfdiUuid } from "~/contexts/receipts-cfdi/application/cfdiQueryService.js";
