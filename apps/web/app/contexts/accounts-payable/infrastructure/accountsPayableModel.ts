/**
 * @module accountsPayableModel
 * @description Data access layer for accounts payable queries using Prisma.
 */
import prisma from "~/platform/db/prisma.server.js";
import type { CfdiComprobante } from "@coco/db";

/** Resultado de `requestExists` — réplica del shape GROUP_CONCAT legacy. */
export interface RequestExistsResult {
  request_id: number;
  request_status_id: number;
  hotel_needed_list: string;
  plane_needed_list: string;
}

/** Resultado de `receiptExists`. */
export interface ReceiptExistsResult {
  receipt_id: number;
  validation: string;
}

/** CFDI esencial expuesto por `getExpenseValidations`. */
export interface ExpenseCfdiSummary {
  nombreEmisor: string;
  rfcEmisor: string;
  fechaEmision: Date;
  subtotal: number;
  iva: number;
  total: number;
  moneda: string;
  uuid: string;
  satEstado: string;
  tipoComprobante: string;
}

/** Una partida de gasto del resultado de `getExpenseValidations`. */
export interface ExpenseValidationItem {
  receipt_id: number;
  receipt_type_name: string | undefined;
  amount: number;
  validation: string;
  sat_estado: string | null;
  pdf_id: string | null;
  pdf_name: string | null;
  xml_id: string | null;
  xml_name: string | null;
  cfdi: ExpenseCfdiSummary | null;
}

/** Resultado de `getExpenseValidations`. */
export interface ExpenseValidationsResult {
  request_id: number;
  request_status_id: number | null;
  request_status_name: string | null;
  status?: string;
  Expenses: ExpenseValidationItem[];
}

/** Recibo con CFDI para validación CPP. */
export interface ReceiptForValidation {
  receipt_id: number;
  request_id: number | null;
  validation: string;
  receipt_type_name: string | null;
  cfdiComprobante: CfdiComprobante | null;
}

/** Mapa código numérico → enum de validación (paridad legacy). */
const VALIDATION_MAP: Record<number, "Pendiente" | "Aprobado" | "Rechazado"> = {
  1: "Pendiente",
  2: "Aprobado",
  3: "Rechazado",
};

/** Estatus de solicitud que CxP ve en su historial (paridad controller legacy). */
const CXP_HISTORIAL_STATUS_IDS = [7, 8];

/** Fila formateada del historial CxP. */
export interface CxpRequestListItem {
  request_id: number;
  request_status: string;
  destination_country: string;
  beginning_date: string;
  ending_date: string;
  requester_name: string;
}

function formatListDate(date: Date | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? "—" : (d.toISOString().split("T")[0] ?? "—");
}

const AccountsPayable = {
  /**
   * Update a travel request status and imposed fee.
   */
  async attendTravelRequest(
    requestId: number,
    imposedFee: number,
    newStatus: number,
  ): Promise<boolean> {
    await prisma.request.update({
      where: { requestId: Number(requestId) },
      data: {
        requestStatusId: Number(newStatus),
        imposedFee: Number(imposedFee),
      },
    });
    return true;
  },

  /**
   * Check if a request exists. Returns the request with hotel/plane info.
   * Replicates the old GROUP_CONCAT comma-separated lists from route data.
   */
  async requestExists(requestId: number): Promise<RequestExistsResult | undefined> {
    const request = await prisma.request.findUnique({
      where: { requestId: Number(requestId) },
      include: {
        routeRequests: {
          include: { route: true },
        },
      },
    });

    if (!request) return undefined;

    const hotelValues = request.routeRequests.map((rr) => (rr.route?.hotelNeeded ? 1 : 0));
    const planeValues = request.routeRequests.map((rr) => (rr.route?.planeNeeded ? 1 : 0));

    return {
      request_id: request.requestId,
      request_status_id: request.requestStatusId,
      hotel_needed_list: hotelValues.join(", "),
      plane_needed_list: planeValues.join(", "),
    };
  },

  /**
   * Get the validation statuses of receipts for a request.
   */
  async getReceiptStatusesForRequest(requestId: number): Promise<string[]> {
    const rows = await prisma.receipt.findMany({
      where: { requestId: Number(requestId) },
      select: { validation: true },
    });
    return rows.map((r) => r.validation);
  },

  /**
   * Update the status of a request.
   */
  async updateRequestStatus(requestId: number, statusId: number): Promise<void> {
    await prisma.request.update({
      where: { requestId: Number(requestId) },
      data: { requestStatusId: Number(statusId) },
    });
  },

  /**
   * Check if a receipt exists in the database.
   */
  async receiptExists(receiptId: number): Promise<ReceiptExistsResult | undefined> {
    const receipt = await prisma.receipt.findUnique({
      where: { receiptId: Number(receiptId) },
      select: { receiptId: true, validation: true },
    });

    if (!receipt) return undefined;

    return {
      receipt_id: receipt.receiptId,
      validation: receipt.validation,
    };
  },

  /**
   * Recibo con CFDI para validación CPP (aprobación / rechazo).
   */
  async findReceiptForValidation(
    receiptId: number,
  ): Promise<ReceiptForValidation | undefined> {
    const receipt = await prisma.receipt.findUnique({
      where: { receiptId: Number(receiptId) },
      include: {
        cfdiComprobante: true,
        receiptType: { select: { receiptTypeName: true } },
      },
    });
    if (!receipt) return undefined;
    return {
      receipt_id: receipt.receiptId,
      request_id: receipt.requestId,
      validation: receipt.validation,
      receipt_type_name: receipt.receiptType?.receiptTypeName ?? null,
      cfdiComprobante: receipt.cfdiComprobante,
    };
  },

  /**
   * Validate (approve or reject) a receipt. `approval` is the integer code
   * (2=Aprobado, 3=Rechazado) — mirrors the legacy `3 - approval` mapping.
   */
  async validateReceipt(receiptId: number, approval: number): Promise<boolean> {
    const validationValue = VALIDATION_MAP[approval] || "Pendiente";
    // `getFinalizedRequestsInRange` filtra por validationDate; sin esta fecha,
    // las solicitudes finalizadas no aparecen en exportación contable.
    const validationDate = validationValue === "Pendiente" ? null : new Date();

    await prisma.receipt.update({
      where: { receiptId: Number(receiptId) },
      data: { validation: validationValue, validationDate },
    });
    return true;
  },

  /**
   * Lista las solicitudes del historial CxP (status 7/8) de la organización
   * activa, formateadas para la tabla. Tenant scoping aplicado por la extensión.
   */
  async getAllRequests(): Promise<CxpRequestListItem[]> {
    const requests = await prisma.request.findMany({
      where: {
        active: true,
        requestStatusId: { in: CXP_HISTORIAL_STATUS_IDS },
      },
      select: {
        requestId: true,
        requestStatus: { select: { status: true } },
        routeRequests: {
          select: {
            route: {
              select: {
                destinationCountry: { select: { countryName: true } },
                beginningDate: true,
                endingDate: true,
              },
            },
          },
          orderBy: { route: { routerIndex: "asc" } },
        },
        user: { select: { userName: true } },
      },
      orderBy: { creationDate: "desc" },
    });

    return requests.map((r) => {
      const firstRoute = r.routeRequests?.[0]?.route;
      const lastRoute = r.routeRequests?.[r.routeRequests.length - 1]?.route;
      return {
        request_id: r.requestId,
        request_status: r.requestStatus?.status || "Desconocido",
        destination_country: firstRoute?.destinationCountry?.countryName || "—",
        beginning_date: formatListDate(firstRoute?.beginningDate),
        ending_date: formatListDate(lastRoute?.endingDate),
        requester_name: r.user?.userName || "Usuario Desconocido",
      };
    });
  },

  /**
   * Get expense validations for a given request.
   */
  async getExpenseValidations(requestId: number): Promise<ExpenseValidationsResult> {
    const request = await prisma.request.findUnique({
      where: { requestId: Number(requestId) },
      select: {
        requestStatusId: true,
        requestStatus: { select: { status: true } },
      },
    });
    const requestStatusId = request?.requestStatusId ?? null;
    const requestStatusName = request?.requestStatus?.status ?? null;

    const rows = await prisma.receipt.findMany({
      where: { requestId: Number(requestId) },
      include: { receiptType: true, cfdiComprobante: true },
    });

    if (rows.length === 0) {
      return {
        request_id: requestId,
        request_status_id: requestStatusId,
        request_status_name: requestStatusName,
        Expenses: [],
      };
    }

    const hasPendingValidation = rows.some((row) => row.validation === "Pendiente");
    const expense_status = hasPendingValidation ? "Pendiente" : "Sin Pendientes";

    const statusOrder: Record<string, number> = { Pendiente: 1, Rechazado: 2, Aprobado: 3 };
    rows.sort((a, b) => (statusOrder[a.validation] ?? 0) - (statusOrder[b.validation] ?? 0));

    return {
      request_id: requestId,
      request_status_id: requestStatusId,
      request_status_name: requestStatusName,
      status: expense_status,
      Expenses: rows.map((row) => {
        const c = row.cfdiComprobante;
        return {
          receipt_id: row.receiptId,
          receipt_type_name: row.receiptType?.receiptTypeName,
          amount: row.amount,
          validation: row.validation,
          sat_estado: c?.satEstado ?? null,
          pdf_id: row.pdfFileId,
          pdf_name: row.pdfFileName,
          xml_id: row.xmlFileId,
          xml_name: row.xmlFileName,
          cfdi: c
            ? {
                nombreEmisor: c.nombreEmisor,
                rfcEmisor: c.rfcEmisor,
                fechaEmision: c.fechaEmision,
                subtotal: c.subtotal,
                iva: c.iva,
                total: c.total,
                moneda: c.moneda,
                uuid: c.uuid,
                satEstado: c.satEstado,
                tipoComprobante: c.tipoComprobante,
              }
            : null,
        };
      }),
    };
  },
};

export default AccountsPayable;
