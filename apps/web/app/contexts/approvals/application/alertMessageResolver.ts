/**
 * @module alertMessageResolver
 * @description Resuelve AlertMessage por texto de catálogo (multi-tenant).
 * Los message_id autoincrementales NO coinciden con request_status_id.
 */

export const REQUEST_STATUS_ALERT_TEXT: Readonly<Record<number, string>> = Object.freeze({
  1: "Se ha abierto una solicitud.",
  2: "Se requiere tu revisión para Primera Revisión.",
  3: "Se requiere tu revisión para Segunda Revisión.",
  4: "La solicitud está lista para generar su cotización de viaje.",
  5: "Se deben asignar los servicios del viaje para la solicitud.",
  6: "Se requiere validar comprobantes de los gastos del viaje.",
  7: "Los comprobantes están listos para validación.",
});

type Db = {
  alertMessage: {
    findFirst(args: {
      where: { organizationId: bigint; messageText: string };
      select: { messageId: true };
    }): Promise<{ messageId: number } | null>;
  };
};

export async function findAlertMessageIdForRequestStatus(
  db: Db,
  organizationId: bigint | number,
  requestStatusId: number,
): Promise<number | null> {
  const text = REQUEST_STATUS_ALERT_TEXT[requestStatusId];
  if (!text) return null;

  const row = await db.alertMessage.findFirst({
    where: {
      organizationId: BigInt(organizationId),
      messageText: text,
    },
    select: { messageId: true },
  });

  return row?.messageId ?? null;
}
