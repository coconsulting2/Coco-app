/**
 * @module JsonImportStrategy
 * @description Strategy para importar usuarios desde JSON.
 *
 * Formato esperado (array de objetos):
 * [
 *   { "userName": "ana.lopez", "email": "ana.lopez@cliente.com", "password": "Temporal123!",
 *     "roleName": "Solicitante", "department": "Finanzas", "firstName": "Ana", "lastName": "López" }
 * ]
 *
 * Wrapper recomendado para JSON de otra empresa:
 * { "roleMappings": { "Approver": "Solicitante" }, "users": [ ... ] }
 *
 * También acepta array directo (sin roleMappings en raíz).
 */
import { BaseImportStrategy } from "~/contexts/onboarding/application/strategies/BaseImportStrategy";
import type {
  ImportUserDTO,
  OrganizationCreateSpec,
  ParsedImportFile,
} from "~/contexts/onboarding/domain/entities/ImportUser";

type JsonRoot = { roleMappings?: unknown; organization?: unknown; users?: unknown } & Record<
  string,
  unknown
>;
type RawRow = Record<string, unknown>;

/** Extrae el mapa `roleMappings` de la raíz del JSON. */
function extractEmbeddedMappings(rawRoot: unknown): Record<string, string> {
  if (!rawRoot || typeof rawRoot !== "object" || Array.isArray(rawRoot)) return {};
  const rm = (rawRoot as JsonRoot).roleMappings;
  if (!rm || typeof rm !== "object" || Array.isArray(rm)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(rm as Record<string, unknown>)) {
    if (typeof k === "string" && typeof v === "string" && k.trim() && v.trim()) {
      out[k.trim()] = v.trim();
    }
  }
  return out;
}

/** Extrae datos de organización nueva desde la raíz del JSON (import onboarding). */
export function extractOrganizationSpecFromJsonRoot(rawRoot: unknown): OrganizationCreateSpec | null {
  if (!rawRoot || typeof rawRoot !== "object" || Array.isArray(rawRoot)) return null;
  const o = (rawRoot as JsonRoot).organization;
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  const org = o as Record<string, unknown>;
  const nombre = String(org.nombre ?? "").trim();
  if (!nombre) return null;
  const rfc =
    org.rfc !== undefined && org.rfc !== null && String(org.rfc).trim() ? String(org.rfc).trim() : null;
  const razonSocial =
    org.razonSocial !== undefined && org.razonSocial !== null && String(org.razonSocial).trim()
      ? String(org.razonSocial).trim()
      : null;
  const timezone =
    typeof org.timezone === "string" && org.timezone.trim() ? org.timezone.trim() : "America/Mexico_City";
  const baseCurrency =
    typeof org.baseCurrency === "string" && org.baseCurrency.trim() ? org.baseCurrency.trim() : "MXN";
  return { nombre, rfc, razonSocial, timezone, baseCurrency };
}

/** Estrategia de importación JSON (usuarios + campos opcionales layout SAP). */
export class JsonImportStrategy extends BaseImportStrategy {
  get mimeTypes(): string[] {
    return ["application/json", "text/json"];
  }

  override get label(): string {
    return "JSON";
  }

  async parse(buffer: Buffer): Promise<ParsedImportFile> {
    let raw: unknown;
    try {
      raw = JSON.parse(buffer.toString("utf-8"));
    } catch {
      throw new Error("El archivo JSON no es válido. Verifica la sintaxis.");
    }

    const embeddedRoleMappings = Array.isArray(raw) ? {} : extractEmbeddedMappings(raw);
    const organizationSpec = Array.isArray(raw) ? null : extractOrganizationSpecFromJsonRoot(raw);

    const rows = Array.isArray(raw) ? raw : (raw as JsonRoot | null)?.users;
    if (!Array.isArray(rows)) {
      throw new Error('El JSON debe ser un array de usuarios o un objeto con propiedad "users".');
    }
    if (rows.length === 0) {
      throw new Error("El archivo JSON está vacío (ningún usuario encontrado).");
    }

    return {
      rows: rows.map((r, i) => this.#normalizeRow(r, i)),
      embeddedRoleMappings,
      organizationSpec,
    };
  }

  #pick(row: RawRow, ...keys: string[]): string | undefined {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") {
        return String(row[k]).trim();
      }
    }
    return undefined;
  }

  #normalizeRow(row: unknown, index: number): ImportUserDTO {
    if (typeof row !== "object" || row === null) {
      throw new Error(`Fila ${index + 1}: se esperaba un objeto, se recibió ${typeof row}.`);
    }
    const r = row as RawRow;
    const dto: ImportUserDTO = {
      userName: String(r.userName ?? r.username ?? "").trim(),
      email: String(r.email ?? "").trim().toLowerCase(),
      password: String(r.password ?? r.pass ?? "").trim(),
      roleName: String(r.roleName ?? r.role ?? r.profile ?? "").trim(),
      department: String(r.department ?? r.dept ?? "").trim() || undefined,
      firstName: String(r.firstName ?? r.first_name ?? "").trim() || undefined,
      lastName: String(r.lastName ?? r.last_name ?? "").trim() || undefined,
    };
    const noEmpleado = this.#pick(r, "noEmpleado", "no_empleado", "employee_id", "emp_id");
    const sapProveedor = this.#pick(r, "sapProveedor", "proveedor", "vendor_no", "vendor_number");
    const sapCeco = this.#pick(r, "sapCeco", "ceco", "cost_center");
    const managerNoEmpleado = this.#pick(r, "managerNoEmpleado", "jefe_inmediato", "jefeInmediato", "manager_id");
    const managerUserName = this.#pick(r, "managerUserName", "manager_username", "reports_to", "manager");
    const sapStatus = this.#pick(r, "sapStatus", "status");
    if (noEmpleado) dto.noEmpleado = noEmpleado;
    if (sapProveedor) dto.sapProveedor = sapProveedor;
    if (sapCeco) dto.sapCeco = sapCeco;
    if (managerNoEmpleado) dto.managerNoEmpleado = managerNoEmpleado;
    if (managerUserName) dto.managerUserName = managerUserName;
    if (sapStatus && (sapStatus === "A" || sapStatus === "I")) dto.sapStatus = sapStatus;
    return dto;
  }
}
