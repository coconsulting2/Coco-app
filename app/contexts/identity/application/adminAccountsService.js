/**
 * @module adminAccountsService
 * @description Use-cases del slice identity para CRUD de cuentas (panel admin).
 * Thin wrapper sobre `adminModel`. Existe para que las routes consuman SOLO
 * use-cases de `application/` y nunca importen modelos directamente.
 *
 * Funciones expuestas:
 *   - deactivateUser(userId)       → desactiva (soft delete) un usuario.
 *   - findUserInOrg(userId, orgId) → wrapper consult.
 */
import Admin from "~/contexts/identity/infrastructure/adminModel.js";

/**
 * Desactiva un usuario (soft delete). RLS aplica via tenant context activo.
 * @param {number} userId
 * @returns {Promise<void>}
 */
export async function deactivateUser(userId) {
  return Admin.deactivateUserById(userId);
}

/**
 * @param {number} userId
 * @param {bigint|number|string} organizationId
 */
export async function findUserInOrg(userId, organizationId) {
  return Admin.findUserByIdInOrg(userId, organizationId);
}
