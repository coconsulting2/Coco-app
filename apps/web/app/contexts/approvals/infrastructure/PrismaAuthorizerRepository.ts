/**
 * @module PrismaAuthorizerRepository
 * @description Adapter Prisma del port `AuthorizerRepository`. Único sitio
 * del slice approvals con acceso a Prisma para queries de autorización.
 */
import prisma from "~/platform/db/prisma.server.js";
import { SolicitudHistorialAccion, Prisma } from "@prisma/client";
import type {
  AuthorizerRepository,
  RequestAuthorizationContext,
  WorkflowAction,
  WorkflowActionPatch,
  WorkflowPreSnapshot,
  AlertItem,
  GetAlertsForAuthorizerInput,
} from "~/contexts/approvals/domain/ports/AuthorizerRepository.js";

function actionToPrisma(action: WorkflowAction): SolicitudHistorialAccion {
  // El enum de Prisma usa los mismos strings que el dominio del slice.
  return action as SolicitudHistorialAccion;
}

export class PrismaAuthorizerRepository implements AuthorizerRepository {
  async getRequestAuthorizationContext(
    requestId: number,
  ): Promise<RequestAuthorizationContext | null> {
    const row = await prisma.request.findUnique({
      where: { requestId: Number(requestId) },
      select: {
        requestStatusId: true,
        workflowPreSnapshot: true,
        requestedFee: true,
        userId: true,
      },
    });
    if (!row) return null;
    const snap =
      row.workflowPreSnapshot && typeof row.workflowPreSnapshot === "object"
        ? (row.workflowPreSnapshot as WorkflowPreSnapshot)
        : null;
    return {
      requestStatusId: row.requestStatusId,
      workflowPreSnapshot: snap,
      requestedFee: row.requestedFee,
      userId: row.userId,
    };
  }

  async getUserRoleName(userId: number): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { userId: Number(userId) },
      include: { role: true },
    });
    return user?.role?.roleName ?? null;
  }

  async getUserMaxApprovalAmount(userId: number): Promise<number | null> {
    const user = await prisma.user.findUnique({
      where: { userId: Number(userId) },
      include: { role: true },
    });
    const v = user?.role?.maxApprovalAmount;
    if (v === undefined || v === null) return null;
    return Number(v);
  }

  async applyWorkflowAction(
    requestId: number,
    patch: WorkflowActionPatch,
    actorUserId: number,
    accion: WorkflowAction,
    comentario: string | null = null,
  ): Promise<void> {
    const rid = Number(requestId);
    const uid = Number(actorUserId);
    await prisma.$transaction(async (tx) => {
      const data: Prisma.RequestUncheckedUpdateInput = {
        requestStatusId: Number(patch.statusId),
      };
      if (Object.prototype.hasOwnProperty.call(patch, "workflowPreSnapshot")) {
        data.workflowPreSnapshot =
          (patch.workflowPreSnapshot ?? Prisma.JsonNull) as Prisma.InputJsonValue;
      }
      await tx.request.update({
        where: { requestId: rid },
        data,
      });
      // organizationId lo inyecta el tenantExtension (Prisma client extension).
      // TS no lo sabe, así que casteamos al input type para no requerirlo aquí.
      const histData = {
        requestId: rid,
        userId: uid,
        accion: actionToPrisma(accion),
        comentario: comentario ?? null,
      } as unknown as Prisma.SolicitudHistorialUncheckedCreateInput;
      await tx.solicitudHistorial.create({ data: histData });
    });
  }

  async getAlertsForAuthorizer(input: GetAlertsForAuthorizerInput): Promise<AlertItem[]> {
    const snapshotPath = input.roleName === "N2" ? ["n2UserId"] : ["n1UserId"];
    const approverFilter = {
      workflowPreSnapshot: {
        path: snapshotPath,
        equals: Number(input.authorizerUserId),
      },
    };
    const orClauses: Array<Record<string, unknown>> = [approverFilter];
    if (input.departmentId != null) {
      orClauses.push({ user: { departmentId: Number(input.departmentId) } });
    }

    const alerts = await prisma.alert.findMany({
      where: {
        request: {
          requestStatusId: Number(input.statusId),
          active: true,
          OR: orClauses,
        },
      },
      include: {
        request: { include: { user: true } },
        alertMessage: true,
      },
      orderBy: { alertDate: "desc" },
      ...(input.limit !== 0 ? { take: Number(input.limit) } : {}),
    });

    return alerts.map((a) => ({
      alert_id: a.alertId,
      user_name: a.request?.user?.userName,
      request_id: a.requestId,
      message_text: a.alertMessage?.messageText,
      alert_date: a.alertDate.toISOString().split("T")[0]!,
      alert_time: a.alertDate.toISOString().split("T")[1]!.split(".")[0]!,
    }));
  }
}
