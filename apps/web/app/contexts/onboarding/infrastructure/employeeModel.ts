// @ts-nocheck — bulk-converted legacy; typed properly is M9 follow-up
/**
 * @module employeeModel
 * @description Data access layer for empleado catalog sync.
 */
import prisma from "~/platform/db/prisma.server.js";

const EmployeeModel = {
  /**
   * @param {bigint|number|string} organizationId
   * @param {string} noEmpleado
   */
  async findByNoEmpleado(organizationId, noEmpleado) {
    return prisma.empleado.findUnique({
      where: {
        organizationId_noEmpleado: {
          organizationId: BigInt(organizationId),
          noEmpleado: String(noEmpleado),
        },
      },
    });
  },

  /**
   * @param {object} data
   */
  async createEmpleado(data) {
    return prisma.empleado.create({ data });
  },

  /**
   * @param {bigint|number|string} organizationId
   * @param {string} noEmpleado
   * @param {object} data
   */
  async updateEmpleado(organizationId, noEmpleado, data) {
    return prisma.empleado.update({
      where: {
        organizationId_noEmpleado: {
          organizationId: BigInt(organizationId),
          noEmpleado: String(noEmpleado),
        },
      },
      data,
    });
  },

  /**
   * Lista empleados por organización.
   * @param {bigint|number|string} organizationId
   * @param {{ status?: string|null }} [filters]
   */
  async listByOrganization(organizationId, { status = null } = {}) {
    const where = { organizationId: BigInt(organizationId) };
    if (status) where.status = String(status).toUpperCase();
    return prisma.empleado.findMany({
      where,
      orderBy: { noEmpleado: "asc" },
    });
  },

  /** Lookup directo del managerUserId — soporta el helper de jerarquía. */
  async getManagerUserId(userId) {
    const row = await prisma.user.findUnique({
      where: { userId: Number(userId) },
      select: { managerUserId: true },
    });
    return row?.managerUserId ?? null;
  },
};

export default EmployeeModel;
