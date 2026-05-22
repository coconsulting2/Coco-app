/**
 * @module createRequestInsertAlert
 * @description Efecto AFTER INSERT Request (ex-trigger CreateAlert).
 * Debe correr con el mismo client/tx que creó el Request.
 */
import { findAlertMessageIdForRequestStatus } from "~/contexts/approvals/application/alertMessageResolver.js";

type Db = Parameters<typeof findAlertMessageIdForRequestStatus>[0] & {
  alert: {
    create(args: {
      data: { requestId: number; messageId: number; organizationId: bigint };
    }): Promise<unknown>;
  };
};

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
