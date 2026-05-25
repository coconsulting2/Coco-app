/**
 * @module accountingPolizaModel
 * @description Persistencia y consulta de pólizas contables (tabla accounting_poliza).
 */
import prisma from "~/platform/db/prisma.server.js";
import { Prisma } from "@coco/db";
import type { AccountingPoliza } from "~/contexts/accounts-payable/domain/entities/AccountingPoliza";

/** Póliza construida por el servicio (cabecera + detalle en claves SAP). */
export type PolizaPayload = AccountingPoliza;

export interface InsertPolizasParams {
  organizationId: bigint | number | string;
  requestId: number;
  polizas: PolizaPayload[];
  requestMarkedExported: boolean;
}

export interface ListPolizasParams {
  organizationId: bigint | number | string;
  requestId?: number | string | null;
  from?: Date;
  to?: Date;
  limit?: number;
}

/** Fila resumida devuelta por `listForOrganization`. */
export interface PolizaListRow {
  id: string;
  requestId: number;
  polizaIndex: number;
  docType: string;
  requestMarkedExported: boolean;
  createdAt: Date;
}

/** Fila con payload devuelta por `findPayloadById`. */
export interface PolizaPayloadRow {
  id: string;
  payload: Prisma.JsonValue;
  requestId: number;
  docType: string;
  createdAt: Date;
}

const AccountingPolizaModel = {
  async insertPolizasForRequest({
    organizationId,
    requestId,
    polizas,
    requestMarkedExported,
  }: InsertPolizasParams): Promise<void> {
    if (!polizas || polizas.length === 0) return;
    const org = BigInt(organizationId);
    await prisma.accountingPoliza.createMany({
      data: polizas.map((p, idx) => ({
        organizationId: org,
        requestId: Number(requestId),
        polizaIndex: idx,
        docType: String(p.header?.DOC_TYPE || "").slice(0, 2),
        payload: p as unknown as Prisma.InputJsonValue,
        requestMarkedExported: Boolean(requestMarkedExported),
      })),
    });
  },

  async listForOrganization({
    organizationId,
    requestId,
    from,
    to,
    limit = 50,
  }: ListPolizasParams): Promise<PolizaListRow[]> {
    const org = BigInt(organizationId);
    const where: Prisma.AccountingPolizaWhereInput = { organizationId: org };
    if (requestId !== undefined && requestId !== null && requestId !== "") {
      where.requestId = Number(requestId);
    }
    if (from || to) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (from) createdAt.gte = from;
      if (to) createdAt.lte = to;
      where.createdAt = createdAt;
    }
    return prisma.accountingPoliza.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(Number(limit) || 50, 1), 200),
      select: {
        id: true,
        requestId: true,
        polizaIndex: true,
        docType: true,
        requestMarkedExported: true,
        createdAt: true,
      },
    });
  },

  async findPayloadById(
    organizationId: bigint | number | string,
    id: string,
  ): Promise<PolizaPayloadRow | null> {
    const org = BigInt(organizationId);
    return prisma.accountingPoliza.findFirst({
      where: { id: String(id), organizationId: org },
      select: { id: true, payload: true, requestId: true, docType: true, createdAt: true },
    });
  },
};

export default AccountingPolizaModel;
