/**
 * @module cfdiQueryService
 * @description Application-layer thin wrapper sobre CfdiModel. Existe para
 * que slices vecinos (travel-requests, accounts-payable) consulten CFDIs
 * SIN importar el modelo Prisma directamente — respeta la regla de no
 * cross-slice por `infrastructure/`.
 */
import CfdiModel, {
  type CfdiUuidRef,
} from "~/contexts/receipts-cfdi/infrastructure/cfdiModel.js";

/** Busca un CFDI por UUID (case-insensitive). Devuelve null si no existe. */
export async function findByCfdiUuid(
  uuid: string | null | undefined,
): Promise<CfdiUuidRef | null> {
  if (!uuid || typeof uuid !== "string") return null;
  return CfdiModel.findByCfdiUuidInsensitive(uuid.toLowerCase());
}
