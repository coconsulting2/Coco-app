/**
 * @module gastoTramoModel
 * @description Data access para `gasto_tramo`: liga receipts a route segments.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from "~/platform/db/prisma.server.js";

const GastoTramo = {
  async createGastoTramo(
    requestId: number,
    routeId: number,
    receiptId: number,
  ): Promise<{ gastoTramoId: number; message: string }> {
    return await prisma.$transaction(async (tx: any) => {
      const request = await tx.request.findUnique({
        where: { requestId: Number(requestId) },
        select: { requestId: true },
      });
      if (!request) throw new Error("VIAJE_NOT_FOUND");

      const routeRequest = await tx.routeRequest.findFirst({
        where: { requestId: Number(requestId), routeId: Number(routeId) },
      });
      if (!routeRequest) throw new Error("TRAMO_NOT_IN_VIAJE");

      const receipt = await tx.receipt.findUnique({
        where: { receiptId: Number(receiptId) },
        select: { receiptId: true, requestId: true },
      });
      if (!receipt) throw new Error("COMPROBANTE_NOT_FOUND");
      if (receipt.requestId !== Number(requestId)) {
        throw new Error("COMPROBANTE_NOT_IN_VIAJE");
      }

      const existing = await tx.gastoTramo.findUnique({
        where: { receiptId: Number(receiptId) },
      });
      if (existing) throw new Error("COMPROBANTE_ALREADY_LINKED");

      const gastoTramo = await tx.gastoTramo.create({
        data: {
          requestId: Number(requestId),
          routeId: Number(routeId),
          receiptId: Number(receiptId),
        },
      });

      return {
        gastoTramoId: gastoTramo.gastoTramoId,
        message: "Comprobante asociado al tramo exitosamente",
      };
    });
  },

  async getResumenTramos(requestId: number): Promise<{
    viaje_id: number;
    tramos: any[];
    total_general: number;
  }> {
    const request = await prisma.request.findUnique({
      where: { requestId: Number(requestId) },
      select: { requestId: true },
    });
    if (!request) throw new Error("VIAJE_NOT_FOUND");

    const routeRequests = await prisma.routeRequest.findMany({
      where: { requestId: Number(requestId) },
      include: {
        route: {
          include: {
            originCountry: true,
            originCity: true,
            destinationCountry: true,
            destinationCity: true,
            gastoTramos: {
              where: { requestId: Number(requestId) },
              include: {
                receipt: { include: { receiptType: true } },
              },
            },
          },
        },
      },
      orderBy: { route: { routerIndex: "asc" } },
    });

    let totalGeneral = 0;
    const tramos = routeRequests.map((rr: any) => {
      const route = rr.route;
      const comprobantes = (route?.gastoTramos ?? []).map((gt: any) => ({
        gasto_tramo_id: gt.gastoTramoId,
        receipt_id: gt.receiptId,
        receipt_type: gt.receipt?.receiptType?.receiptTypeName ?? null,
        amount: Number(gt.receipt?.amount ?? 0),
        validation: gt.receipt?.validation ?? null,
        submission_date: gt.receipt?.submissionDate ?? null,
      }));

      const totalTramo = comprobantes.reduce(
        (sum: number, c: { amount: number }) => sum + c.amount,
        0,
      );
      totalGeneral += totalTramo;

      return {
        tramo_id: route?.routeId ?? null,
        router_index: route?.routerIndex ?? null,
        origin_country: route?.originCountry?.countryName ?? null,
        origin_city: route?.originCity?.cityName ?? null,
        destination_country: route?.destinationCountry?.countryName ?? null,
        destination_city: route?.destinationCity?.cityName ?? null,
        beginning_date: route?.beginningDate ?? null,
        ending_date: route?.endingDate ?? null,
        comprobantes,
        total_tramo: totalTramo,
      };
    });

    return {
      viaje_id: Number(requestId),
      tramos,
      total_general: totalGeneral,
    };
  },
};

export default GastoTramo;
