/**
 * @module index
 * @description API pública del slice receipts-cfdi.
 */

export type { Receipt } from "~/contexts/receipts-cfdi/domain/entities/Receipt";
export type { ReceiptRepository } from "~/contexts/receipts-cfdi/domain/ports/ReceiptRepository";
export type { CfdiRepository } from "~/contexts/receipts-cfdi/domain/ports/CfdiRepository";
export type { FileStore } from "~/contexts/receipts-cfdi/domain/ports/FileStore";
export { ReceiptsCfdiError, ReceiptNotFoundError, CfdiAlreadyExistsError, InvalidCfdiXmlError } from "~/contexts/receipts-cfdi/domain/errors";

// @ts-ignore — JS module
export { registerComprobante, getComprobante } from "~/contexts/receipts-cfdi/application/comprobantesService.js";
// @ts-ignore — JS module
export { uploadReceiptFiles, getReceiptFile } from "~/contexts/receipts-cfdi/application/receiptFileService.js";
// @ts-ignore — JS module
export { parseCFDI, buildComprobanteRegistroBodyFromXml, selloUltimos8FromSello, CfdiParseError } from "~/contexts/receipts-cfdi/application/cfdiParserService.js";
// @ts-ignore — JS module
export { findByCfdiUuid } from "~/contexts/receipts-cfdi/application/cfdiQueryService.js";
