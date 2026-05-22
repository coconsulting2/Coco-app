/**
 * @module approvalSubstituteModel
 * @description Data access para sustitutos y aprobaciones stale.
 */
import prisma from "~/platform/db/prisma.server.js";
import { findAlertMessageIdForRequestStatus } from "~/contexts/approvals/application/alertMessageResolver.js";

const STALE_HOURS = 48;

export type Substitute = {
  id: number;
  approverId: number;
  substituteId: number;
  validFrom: Date;
  validTo: Date;
};

export type StaleRequest = {
  requestId: number;
  requestStatusId: number;
  workflowPreSnapshot: unknown;
  lastModDate: Date;
};

const ApprovalSubstituteModel = {
  async listByApprover(approverId: number): Promise<Substitute[]> {
    return prisma.$queryRaw<Substitute[]>`
      SELECT
        id,
        approver_id AS "approverId",
        substitute_id AS "substituteId",
        valid_from AS "validFrom",
        valid_to AS "validTo"
      FROM approval_substitutes
      WHERE approver_id = ${Number(approverId)}
      ORDER BY valid_from DESC, id DESC
    `;
  },

  async createSubstitute(input: {
    approverId: number;
    substituteId: number;
    validFrom: Date;
    validTo: Date;
  }): Promise<Substitute | null> {
    const rows = await prisma.$queryRaw<Substitute[]>`
      INSERT INTO approval_substitutes
        (approver_id, substitute_id, valid_from, valid_to)
      VALUES
        (${Number(input.approverId)}, ${Number(input.substituteId)}, ${input.validFrom}, ${input.validTo})
      RETURNING
        id,
        approver_id AS "approverId",
        substitute_id AS "substituteId",
        valid_from AS "validFrom",
        valid_to AS "validTo"
    `;
    return rows[0] ?? null;
  },

  async deleteSubstitute(id: number, approverId: number): Promise<boolean> {
    const rows = await prisma.$queryRaw<Array<{ id: number }>>`
      DELETE FROM approval_substitutes
      WHERE id = ${Number(id)}
        AND approver_id = ${Number(approverId)}
      RETURNING id
    `;
    return (rows[0]?.id ?? null) !== null;
  },

  async getUserRoleName(userId: number): Promise<string | null> {
    const rows = await prisma.$queryRaw<Array<{ roleName: string }>>`
      SELECT r.role_name AS "roleName"
      FROM "User" u
      JOIN "Role" r ON r.role_id = u.role_id
      WHERE u.user_id = ${Number(userId)}
      LIMIT 1
    `;
    return rows[0]?.roleName ?? null;
  },

  async getActiveSubstitute(approverId: number, nowDate: Date): Promise<Substitute | null> {
    const rows = await prisma.$queryRaw<Substitute[]>`
      SELECT
        id,
        approver_id AS "approverId",
        substitute_id AS "substituteId",
        valid_from AS "validFrom",
        valid_to AS "validTo"
      FROM approval_substitutes
      WHERE approver_id = ${Number(approverId)}
        AND valid_from <= ${nowDate}
        AND valid_to >= ${nowDate}
      ORDER BY valid_from DESC, id DESC
      LIMIT 1
    `;
    return rows[0] ?? null;
  },

  async listStalePendingRequests(nowDate: Date): Promise<StaleRequest[]> {
    return prisma.$queryRaw<StaleRequest[]>`
      SELECT
        r.request_id AS "requestId",
        r.request_status_id AS "requestStatusId",
        r.workflow_pre_snapshot AS "workflowPreSnapshot",
        r.last_mod_date AS "lastModDate"
      FROM "Request" r
      WHERE r.request_status_id IN (2, 3)
        AND r.last_mod_date <= (${nowDate}::timestamptz - (${STALE_HOURS} || ' hour')::interval)
    `;
  },

  async applyWorkflowAction(
    requestId: number,
    patch: { statusId: number; workflowPreSnapshot?: unknown },
    actorUserId: number,
    accion: "REASIGNADO" | "ESCALADO" | "RECHAZADO" | "APROBADO",
    comentario: string | null = null,
  ): Promise<void> {
    const rid = Number(requestId);
    const uid = Number(actorUserId);
    await prisma.$transaction(async (tx) => {
      const data: Record<string, unknown> = { requestStatusId: Number(patch.statusId) };
      if (Object.prototype.hasOwnProperty.call(patch, "workflowPreSnapshot")) {
        data.workflowPreSnapshot = patch.workflowPreSnapshot;
      }
      const updated = await tx.request.update({
        where: { requestId: rid },
        data,
        select: { organizationId: true },
      });
      await tx.solicitudHistorial.create({
        data: {
          requestId: rid,
          userId: uid,
          organizationId: updated.organizationId,
          accion,
          comentario: comentario ?? null,
        },
      });
    });
  },

  async createAlert(requestId: number, requestStatusId: number | null = null): Promise<void> {
    const request = await prisma.request.findUnique({
      where: { requestId: Number(requestId) },
      select: { organizationId: true, requestStatusId: true },
    });
    if (!request) return;

    const statusId = Number(requestStatusId ?? request.requestStatusId);
    const messageId = await findAlertMessageIdForRequestStatus(
      prisma as unknown as Parameters<typeof findAlertMessageIdForRequestStatus>[0],
      request.organizationId,
      statusId,
    );
    if (!messageId) return;

    await prisma.alert.create({
      data: {
        requestId: Number(requestId),
        messageId,
        organizationId: request.organizationId,
      },
    });
  },
};

export default ApprovalSubstituteModel;
