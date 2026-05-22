/**
 * @module reimbursementTimeQueries
 * @description Queries Prisma para configuración de tiempo límite de
 * reembolso y bloqueo de solicitudes vencidas. Extracción Fase 6 desde
 * reimbursementTimeService.js (application/).
 */
import prisma from "~/platform/db/prisma.server.js";

/**
 * @param {bigint | number} organizationId
 * @returns {Promise<object | null>}
 */
export async function findTimeLimitByOrg(organizationId) {
  return prisma.reimbursementTimeLimit.findUnique({ where: { organizationId } });
}

/**
 * @param {bigint | number} organizationId
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function upsertTimeLimit(organizationId, data) {
  return prisma.reimbursementTimeLimit.upsert({
    where: { organizationId },
    update: data,
    create: { organizationId, ...data },
  });
}

/**
 * Lookup de Request con campos necesarios para validación de deadline.
 * @param {number} requestId
 * @returns {Promise<object | null>}
 */
export async function findRequestForDeadline(requestId) {
  return prisma.request.findUnique({
    where: { requestId: Number(requestId) },
    select: {
      requestId: true,
      tripEndDate: true,
      user: { select: { organizationId: true } },
    },
  });
}

/**
 * Candidatos a cierre automático (status no terminal + tripEndDate fijo).
 * @param {number[]} terminalStatusIds
 * @returns {Promise<object[]>}
 */
export async function findExpiredCandidates(terminalStatusIds) {
  return prisma.request.findMany({
    where: {
      tripEndDate: { not: null },
      requestStatusId: { notIn: terminalStatusIds },
    },
    select: {
      requestId: true,
      tripEndDate: true,
      requestStatusId: true,
      userId: true,
      user: { select: { organizationId: true, userId: true } },
    },
  });
}

/**
 * Cierre automático transaccional: actualiza status a 8 (Finalizado) +
 * inserta entrada en SolicitudHistorial.
 *
 * @param {number} requestId
 * @param {number} userId
 * @param {string} comentario
 * @returns {Promise<void>}
 */
export async function lockRequestAutomatic(requestId, userId, comentario) {
  await prisma.$transaction(async (tx) => {
    await tx.request.update({
      where: { requestId },
      data: { requestStatusId: 8 },
    });
    await tx.solicitudHistorial.create({
      data: {
        requestId,
        userId,
        accion: "RECHAZADO",
        comentario,
      },
    });
  });
}
