/**
 * @module employeeSyncService
 * @description Sincronización de catálogo empleado desde RH/SAP.
 */
import EmployeeModel from "~/contexts/onboarding/infrastructure/employeeModel.js";

const VALID_TYPES = new Set(["Alta", "Baja", "Cambio", "Reingreso"]);

/** Error de sincronización con status HTTP (parity con el legacy). */
type SyncError = { status: number; message: string };

type SyncDetalle = {
  noEmpleado: string;
  nombre: string;
  proveedor: string;
  ceco: string;
  fechaAlta: string;
  tipo: string;
  email?: string | null;
  jefeInmediato?: string | null;
};

type SyncPayload = {
  header?: { idTransaction?: string | number | null } | null;
  detalle?: SyncDetalle | null;
};

type SyncReqUser = { user_name?: string | null; user_id?: string | number | null } | null;

type SyncResult = {
  idTransaction: string;
  status: "success";
  noEmpleado: string;
  accion_realizada: "created" | "deactivated" | "reactivated" | "updated";
};

function asDate(isoDate: string): Date | null {
  const d = new Date(String(isoDate));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function validatePayload(payload: SyncPayload): {
  idTransaction: string;
  detalle: SyncDetalle;
  fechaAlta: Date;
} {
  const idTransaction = payload?.header?.idTransaction;
  const detalle = payload?.detalle;
  if (!idTransaction || !detalle) {
    const err: SyncError = {
      status: 400,
      message: "Payload inválido: header.idTransaction y detalle son obligatorios",
    };
    throw err;
  }
  const required: Array<keyof SyncDetalle> = [
    "noEmpleado",
    "nombre",
    "proveedor",
    "ceco",
    "fechaAlta",
    "tipo",
  ];
  for (const k of required) {
    if (!detalle?.[k]) {
      const err: SyncError = { status: 400, message: `Campo obligatorio faltante: detalle.${k}` };
      throw err;
    }
  }
  if (!VALID_TYPES.has(detalle.tipo)) {
    const err: SyncError = { status: 400, message: "detalle.tipo debe ser Alta|Baja|Cambio|Reingreso" };
    throw err;
  }
  const parsed = asDate(detalle.fechaAlta);
  if (!parsed) {
    const err: SyncError = { status: 400, message: "detalle.fechaAlta debe ser fecha válida YYYY-MM-DD" };
    throw err;
  }
  return { idTransaction: String(idTransaction), detalle, fechaAlta: parsed };
}

function actorFromReqUser(reqUser: SyncReqUser): string {
  if (reqUser?.user_name) return String(reqUser.user_name).slice(0, 30);
  if (reqUser?.user_id != null) return `user_${String(reqUser.user_id)}`.slice(0, 30);
  return "api_sync";
}

export async function syncEmployee(
  organizationId: bigint | number | string,
  payload: SyncPayload,
  reqUser: SyncReqUser = null,
): Promise<SyncResult> {
  const { idTransaction, detalle, fechaAlta } = validatePayload(payload);
  const actor = actorFromReqUser(reqUser);
  const existing = await EmployeeModel.findByNoEmpleado(organizationId, detalle.noEmpleado);
  const baseData = {
    nombre: String(detalle.nombre).slice(0, 100),
    email: detalle.email ? String(detalle.email).slice(0, 100) : null,
    jefeInmediato: detalle.jefeInmediato ? String(detalle.jefeInmediato).slice(0, 10) : null,
    proveedor: String(detalle.proveedor).slice(0, 11),
    ceco: String(detalle.ceco).slice(0, 10),
    fechaAlta,
    usuarioUltimaModificacion: actor,
  };

  if (detalle.tipo === "Alta") {
    if (existing) {
      const err: SyncError = { status: 409, message: `Empleado ${detalle.noEmpleado} ya existe` };
      throw err;
    }
    await EmployeeModel.createEmpleado({
      organizationId: BigInt(organizationId),
      noEmpleado: String(detalle.noEmpleado).slice(0, 10),
      ...baseData,
      status: "A",
    });
    return {
      idTransaction,
      status: "success",
      noEmpleado: String(detalle.noEmpleado),
      accion_realizada: "created",
    };
  }

  if (!existing) {
    const err: SyncError = { status: 404, message: `Empleado ${detalle.noEmpleado} no existe` };
    throw err;
  }

  if (detalle.tipo === "Baja") {
    await EmployeeModel.updateEmpleado(organizationId, detalle.noEmpleado, {
      status: "I",
      usuarioUltimaModificacion: actor,
    });
    return {
      idTransaction,
      status: "success",
      noEmpleado: String(detalle.noEmpleado),
      accion_realizada: "deactivated",
    };
  }

  if (detalle.tipo === "Reingreso") {
    await EmployeeModel.updateEmpleado(organizationId, detalle.noEmpleado, {
      ...baseData,
      status: "A",
    });
    return {
      idTransaction,
      status: "success",
      noEmpleado: String(detalle.noEmpleado),
      accion_realizada: "reactivated",
    };
  }

  await EmployeeModel.updateEmpleado(organizationId, detalle.noEmpleado, baseData);
  return {
    idTransaction,
    status: "success",
    noEmpleado: String(detalle.noEmpleado),
    accion_realizada: "updated",
  };
}

export default {
  syncEmployee,
};
