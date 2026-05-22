/**
 * @module trigger-extension.server (apps/web)
 * @description Prisma client extension que replica los 5 triggers MariaDB del
 * backend legacy:
 *   1. DeactivateRequest        (BEFORE UPDATE Request)
 *   2. CreateAlert              (AFTER INSERT Request) — aplicado en applicantModel + mismo tx
 *   3. ManageAlertAfterRequestUpdate (AFTER UPDATE Request)
 *   4. DeductFromWalletOnFeeImposed  (AFTER UPDATE Request)
 *   5. AddToWalletOnReceiptApproved  (AFTER UPDATE Receipt)
 *
 * Vive en apps/web porque depende de lógica de dominio (alertMessageResolver del
 * slice approvals). El paquete `@coco/db` no debe conocer dominio: provee
 * prismaBase y tenantExtension, apps/web compone los triggers encima.
 */
import { Prisma } from "@prisma/client";
import { findAlertMessageIdForRequestStatus } from "~/contexts/approvals/application/alertMessageResolver.js";

type AnyClient = {
  request: {
    findUnique: (args: { where: unknown; select?: unknown }) => Promise<unknown>;
  };
  alert: {
    deleteMany: (args: { where: unknown }) => Promise<unknown>;
    updateMany: (args: { where: unknown; data: unknown }) => Promise<unknown>;
  };
  user: {
    update: (args: { where: unknown; data: unknown }) => Promise<unknown>;
  };
  receipt: {
    findUnique: (args: { where: unknown; select?: unknown }) => Promise<unknown>;
  };
};

type OldRequest = {
  requestStatusId: number;
  imposedFee: number | null;
  userId: number | null;
  organizationId?: bigint;
};

type UpdatedRequest = {
  requestId: number;
  requestStatusId: number;
  imposedFee: number | null;
  userId: number | null;
  organizationId: bigint;
};

type OldReceipt = {
  validation: string | null;
};

type UpdatedReceipt = {
  validation: string | null;
  requestId: number | null;
  amount: number;
};

export const triggerExtension = Prisma.defineExtension((client) =>
  client.$extends({
    name: "coco-domain-triggers",
    query: {
      request: {
        // Trigger 2 (CreateAlert AFTER INSERT) se aplica inline en applicantModel
        // dentro del mismo $transaction; aquí solo delegamos.
        async create({ args, query }) {
          return query(args);
        },

        async update({ args, query }) {
          // --- Trigger 1: DeactivateRequest (BEFORE UPDATE) -----------------
          const data = args.data as Record<string, unknown> | undefined;
          const incomingStatusId = data?.requestStatusId as number | undefined;
          if (incomingStatusId === 9 || incomingStatusId === 10) {
            args.data = { ...(data ?? {}), active: false };
          }

          // Fetch old values (necesario para triggers 3 y 4).
          const c = client as unknown as AnyClient;
          const oldRequest = (await c.request.findUnique({
            where: args.where,
            select: { requestStatusId: true, imposedFee: true, userId: true, organizationId: true },
          })) as OldRequest | null;

          const result = (await query(args)) as UpdatedRequest;

          if (oldRequest) {
            // --- Trigger 3: ManageAlertAfterRequestUpdate -------------------
            const newStatusId = result.requestStatusId;
            if ([8, 9, 10].includes(newStatusId)) {
              await c.alert.deleteMany({ where: { requestId: result.requestId } });
            } else if (oldRequest.requestStatusId !== newStatusId) {
              const messageId = await findAlertMessageIdForRequestStatus(
                client,
                result.organizationId,
                newStatusId,
              );
              if (messageId) {
                await c.alert.updateMany({
                  where: { requestId: result.requestId },
                  data: { messageId },
                });
              }
            }

            // --- Trigger 4: DeductFromWalletOnFeeImposed --------------------
            const newFee = result.imposedFee;
            const oldFee = oldRequest.imposedFee;
            if (
              newFee !== null &&
              newFee !== undefined &&
              (oldFee === null || oldFee === undefined || newFee !== oldFee)
            ) {
              const diff = newFee - (oldFee ?? 0);
              if (diff !== 0 && result.userId) {
                await c.user.update({
                  where: { userId: result.userId },
                  data: { wallet: { decrement: diff } },
                });
              }
            }
          }

          return result;
        },
      },

      receipt: {
        // --- Trigger 5: AddToWalletOnReceiptApproved (AFTER UPDATE) ---------
        async update({ args, query }) {
          const c = client as unknown as AnyClient;
          const oldReceipt = (await c.receipt.findUnique({
            where: args.where,
            select: { validation: true },
          })) as OldReceipt | null;

          const result = (await query(args)) as UpdatedReceipt;

          if (
            oldReceipt &&
            result.validation === "Aprobado" &&
            oldReceipt.validation !== "Aprobado" &&
            result.requestId != null
          ) {
            const request = (await c.request.findUnique({
              where: { requestId: result.requestId },
              select: { userId: true },
            })) as { userId: number | null } | null;
            if (request && request.userId) {
              await c.user.update({
                where: { userId: request.userId },
                data: { wallet: { increment: result.amount } },
              });
            }
          }

          return result;
        },
      },
    },
  }),
);
