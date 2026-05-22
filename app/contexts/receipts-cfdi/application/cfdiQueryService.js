/**
 * @module cfdiQueryService
 * @description Application-layer thin wrapper sobre CfdiModel. Existe para
 * que slices vecinos (travel-requests, accounts-payable) consulten CFDIs
 * SIN importar el modelo Prisma directamente — respeta la regla de no
 * cross-slice por `infrastructure/`.
 */
import CfdiModel from "~/contexts/receipts-cfdi/infrastructure/cfdiModel.js";

/**
 * Busca un CFDI por UUID (case-insensitive). Devuelve null si no existe.
 * @param {string} uuid - UUID del CFDI (cualquier casing)
 * @returns {Promise<object|null>}
 */
export async function findByCfdiUuid(uuid) {
  if (!uuid || typeof uuid !== "string") return null;
  return CfdiModel.findByCfdiUuidInsensitive(uuid.toLowerCase());
}
