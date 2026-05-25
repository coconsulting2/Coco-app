/**
 * @module PrismaExpenseReportQueries
 * @description Adapter Prisma del puerto `ExpenseReportQueries`. Envuelve la
 * agregación (`buildExpensesByCostCenterReport` +
 * `resolveExpenseReportVisibleUserIds` de `application/expenseReportService`)
 * con el cliente Prisma del web app, exponiéndola tipada para el use-case
 * `getExpensesByCC`.
 */
import prisma from "~/platform/db/prisma.server.js";
import {
  buildExpensesByCostCenterReport,
  resolveExpenseReportVisibleUserIds,
  type ExpenseReportPrismaClient,
} from "~/contexts/accounts-payable/application/expenseReportService.js";
import type {
  ExpenseReportQueries,
  ExpenseReportQuery,
  ExpensesByCostCenterReport,
} from "~/contexts/accounts-payable/domain/ports/ExpenseReportQueries";

export class PrismaExpenseReportQueries implements ExpenseReportQueries {
  async resolveVisibleUserIds(
    actorUserId: number,
    permissionSet: Set<string> | undefined,
  ): Promise<number[] | null> {
    return resolveExpenseReportVisibleUserIds(actorUserId, permissionSet);
  }

  async buildExpensesByCostCenter(
    orgId: number,
    query: ExpenseReportQuery,
    options: { visibleUserIds: number[] | null },
  ): Promise<ExpensesByCostCenterReport> {
    return buildExpensesByCostCenterReport(
      prisma as unknown as ExpenseReportPrismaClient,
      query,
      orgId,
      options,
    );
  }
}
