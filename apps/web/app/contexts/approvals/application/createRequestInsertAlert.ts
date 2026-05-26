/**
 * @module createRequestInsertAlert
 * @description Efecto AFTER INSERT Request (ex-trigger CreateAlert).
 * Debe correr con el mismo client/tx que creó el Request.
 */
import { findAlertMessageIdForRequestStatus } from "~/contexts/approvals/application/alertMessageResolver.js";
import type { WebTransactionClient } from "~/platform/db/prisma.server.js";

type Db = Pick<WebTransactionClient, "alert" | "alertMessage">;

export async function createRequestInsertAlert(
  db: Db,
  request: { requestId: number; requestStatusId: number; organizationId: bigint | number },
): Promise<void> {
  const statusId = request.requestStatusId;
  const messageId = await findAlertMessageIdForRequestStatus(
    db,
    request.organizationId,
    statusId,
  );
  if (!messageId) {
    console.warn(
      `[createRequestInsertAlert] Sin AlertMessage para org=${request.organizationId} status=${statusId}`,
    );
    return;
  }
  await db.alert.create({
    data: {
      requestId: request.requestId,
      messageId,
      organizationId: BigInt(request.organizationId),
    },
  });
}
