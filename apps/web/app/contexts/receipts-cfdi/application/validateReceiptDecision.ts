/**
 * @module validateReceiptDecision
 * @description Use-case puro (DI por parámetro) que aprueba o rechaza un
 * comprobante individual con paridad 1:1 contra el legacy
 * `accountsPayableController.validateReceipt`.
 *
 * Flujo:
 *  1. Valida shape de la decisión y comentario (obligatorio al rechazar).
 *  2. Carga el receipt; rechaza si ya está decidido.
 *  3. Si aprueba: valida deadline + presencia de CFDI + consulta SAT +
 *     persiste acuse + verifica `estado === Vigente` y EFOS no-blacklisted.
 *  4. Persiste el cambio de validación (Aprobado | Rechazado).
 *  5. Si rechazó: publica un comentario en el chat de la solicitud.
 *  6. Sincroniza el status de la solicitud (Finalizado / rollback / sin cambio).
 *
 * Errores tipados — los callers (action RR7) los traducen a HTTP status.
 */
import { Logger } from "~/platform/logger/log/logger.js";
import type { CfdiValidator } from "~/contexts/receipts-cfdi/domain/ports/CfdiValidator.js";
import type { ReceiptValidationRepository } from "~/contexts/receipts-cfdi/domain/ports/ReceiptValidationRepository.js";
import type { CfdiAcuseWriter } from "~/contexts/receipts-cfdi/domain/ports/CfdiAcuseWriter.js";
import type { CommentsService } from "~/contexts/receipts-cfdi/domain/ports/CommentsService.js";
import type { ExpenseDeadlineChecker } from "~/contexts/receipts-cfdi/domain/ports/ExpenseDeadlineChecker.js";
import type {
  ReceiptsLifecycleSyncer,
  SyncRequestStatusResult,
} from "~/contexts/receipts-cfdi/domain/ports/ReceiptsLifecycleSyncer.js";
import type { ReceiptDecision } from "~/contexts/receipts-cfdi/domain/entities/ReceiptValidation.js";

import {
  CommentRequiredError,
  EfosBlacklistedError,
  InvalidDecisionError,
  ReceiptAlreadyDecidedError,
  ReceiptDeadlinePassedError,
  ReceiptMissingCfdiError,
  ReceiptNotFoundError,
  ReceiptValidationPersistError,
  SatRejectedError,
} from "~/contexts/receipts-cfdi/domain/errors.js";

/**
 * Códigos EFOS que bloquean la aprobación. Replicados verbatim del legacy
 * `accountsPayableController.EFOS_EMISOR_BLACKLIST_APPROVAL`.
 */
const EFOS_BLACKLIST: readonly string[] = ["100", "101", "104"];

const logger = Logger("validateReceiptDecision");

export type ValidateReceiptDecisionInput = {
  receiptId: number;
  decision: ReceiptDecision;
  comment?: string | null;
  /** Usuario CxP que decide (para auditar el comentario de rechazo). */
  userId: number;
};

export type ValidateReceiptDecisionDeps = {
  receipts: ReceiptValidationRepository;
  cfdiValidator: CfdiValidator;
  cfdiAcuse: CfdiAcuseWriter;
  comments: CommentsService;
  deadline: ExpenseDeadlineChecker;
  lifecycle: ReceiptsLifecycleSyncer;
};

export type ValidateReceiptDecisionResult = {
  receiptId: number;
  newValidation: "Aprobado" | "Rechazado";
  satAcuse?: {
    estado: string;
    validacionEFOS: string;
    codigoEstatus: string;
  };
  commentPosted: boolean;
  lifecycleSync: SyncRequestStatusResult;
};

export async function validateReceiptDecision(
  input: ValidateReceiptDecisionInput,
  deps: ValidateReceiptDecisionDeps,
): Promise<ValidateReceiptDecisionResult> {
  if (input.decision !== "approve" && input.decision !== "reject") {
    throw new InvalidDecisionError();
  }

  let rejectComment: string | null = null;
  if (input.decision === "reject") {
    const trimmed = (input.comment ?? "").trim();
    if (!trimmed) throw new CommentRequiredError();
    rejectComment = trimmed;
  }

  const receipt = await deps.receipts.findForValidation(input.receiptId);
  if (!receipt) throw new ReceiptNotFoundError();
  if (receipt.validation !== "Pendiente") throw new ReceiptAlreadyDecidedError();

  let satAcuse: ValidateReceiptDecisionResult["satAcuse"];

  if (input.decision === "approve") {
    const within = await deps.deadline.isWithinDeadline(receipt.requestId);
    if (!within) throw new ReceiptDeadlinePassedError();
    if (!receipt.cfdiComprobante) throw new ReceiptMissingCfdiError();

    const acuse = await deps.cfdiValidator.validate({
      rfcEmisor: receipt.cfdiComprobante.rfcEmisor,
      rfcReceptor: receipt.cfdiComprobante.rfcReceptor,
      total: receipt.cfdiComprobante.total,
      uuid: receipt.cfdiComprobante.uuid,
      selloUltimos8: null,
    });

    // Persiste acuse en CFDI (audit trail) antes de validar veredicto.
    await deps.cfdiAcuse.updateAcuseByReceiptId(input.receiptId, acuse);

    if (acuse.estado !== "Vigente") throw new SatRejectedError(acuse.estado);
    if (EFOS_BLACKLIST.includes(String(acuse.validacionEFOS))) {
      throw new EfosBlacklistedError(String(acuse.validacionEFOS));
    }

    satAcuse = {
      estado: acuse.estado,
      validacionEFOS: String(acuse.validacionEFOS),
      codigoEstatus: acuse.codigoEstatus,
    };
  }

  const updated = await deps.receipts.setValidation(input.receiptId, input.decision);
  if (!updated) throw new ReceiptValidationPersistError();

  const newValidation: "Aprobado" | "Rechazado" =
    input.decision === "approve" ? "Aprobado" : "Rechazado";

  let commentPosted = false;
  if (input.decision === "reject" && rejectComment) {
    const typeLabel = receipt.receiptTypeName
      ? `«${receipt.receiptTypeName}»`
      : `#${input.receiptId}`;
    const commentBody = `Comprobante ${typeLabel} rechazado: ${rejectComment}`;
    const result = await deps.comments.postRequestComment({
      userId: input.userId,
      requestId: receipt.requestId,
      content: commentBody,
    });
    commentPosted = result.success;
    if (!result.success) {
      // Paridad legacy: si el comentario falla, el rechazo igual se persiste.
      logger.warn(
        { receiptId: input.receiptId, requestId: receipt.requestId, error: result.error },
        "receipt rejected; comment NOT saved",
      );
    }
  }

  const lifecycleSync = await deps.lifecycle.syncRequestStatusAfterReceiptDecision(
    receipt.requestId,
  );

  return {
    receiptId: input.receiptId,
    newValidation,
    satAcuse,
    commentPosted,
    lifecycleSync,
  };
}
