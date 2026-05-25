/**
 * @module ImportUser
 * @description Tipos puros del flujo de importación de onboarding (preview/apply).
 * Las estrategias normalizan filas a `ImportUserDTO`; el servicio cruza con BD
 * y produce las respuestas `PreviewImportResult` / `ApplyImportResult`.
 */

/** Fila normalizada por una estrategia de parseo (CSV/JSON), antes de validar. */
export type ImportUserDTO = {
  /** Identificador único de usuario (login). */
  userName: string;
  email: string;
  /** Contraseña en claro del archivo (opcional; se descarta en apply). */
  password?: string;
  /** Nombre de rol o etiqueta externa a mapear. */
  roleName: string;
  department?: string;
  firstName?: string;
  lastName?: string;
  /** Clave empleado externa (SAP/RH). */
  noEmpleado?: string;
  /** Jefe inmediato (adjacency list SAP: no_empleado). */
  managerNoEmpleado?: string;
  /** Login del jefe (CSV/JSON estándar → User.managerUserId). */
  managerUserName?: string;
  sapCeco?: string;
  sapProveedor?: string;
  sapStatus?: "A" | "I" | string;
  /** Número de fila en el archivo origen (1-indexed). */
  _row?: number;
};

/** Sociedad contable detectada en un archivo multi-sección. */
export type ImportSociety = { code: string; name: string };

/** Departamento/CeCo detectado en un archivo multi-sección. */
export type ImportDepartment = { costsCenter: string; departmentName: string };

/** Bloque `organization` del JSON para crear una org CLIENT nueva. */
export type OrganizationCreateSpec = {
  nombre: string;
  rfc?: string | null;
  razonSocial?: string | null;
  timezone?: string;
  baseCurrency?: string;
};

/** Resultado del parseo de una estrategia. */
export type ParsedImportFile = {
  rows: ImportUserDTO[];
  embeddedRoleMappings: Record<string, string>;
  organizationSpec?: OrganizationCreateSpec | null;
  societies?: ImportSociety[];
  departments?: ImportDepartment[];
};

/** Error de validación a nivel de fila/campo. */
export type ImportValidationError = { row: number; field: string; message: string };

/** Conflicto contra la BD (userName/email ya existe). */
export type ImportConflict = { userName: string; email: string; reason: string };

/** Permiso del catálogo agrupado por recurso. */
export type PermissionCatalogItem = { code: string; action: string; description: string | null };
export type PermissionCatalogGroup = {
  resource: string;
  label: string;
  items: PermissionCatalogItem[];
};
export type PermissionsCatalog = { groups: PermissionCatalogGroup[] };

/** Fila de la vista previa que ve el admin. */
export type ImportUserPreviewRow = {
  userName: string;
  email: string;
  department?: string;
  firstName?: string;
  lastName?: string;
  roleName?: string;
  externalRoleLabel?: string;
  needsRoleMapping: boolean;
  rolePermissionCodes: string[];
  /** @deprecated usar rolePermissionCodes. */
  effectivePermissions: string[];
  hasFilePassword: boolean;
};

/** Rol de la org + permisos efectivos (referencia para la UI). */
export type RoleCatalogEntry = { roleName: string; effectivePermissions: string[] };

/** Respuesta de la fase preview. */
export type PreviewImportResult = {
  previewToken: string;
  strategy: "JSON" | "CSV";
  totalRows: number;
  validRows: number;
  invalidRows: number;
  conflictRows: number;
  needsRoleMappingCount: number;
  unmappedExternalRoles: string[];
  embeddedRoleMappingsFromFile?: Record<string, string>;
  fileHadPasswords: boolean;
  preview: ImportUserPreviewRow[];
  applyableUsernames: string[];
  permissionsCatalog: PermissionsCatalog;
  rolesCatalog: RoleCatalogEntry[];
  errors: ImportValidationError[];
  conflicts: ImportConflict[];
  societies: ImportSociety[];
  departments: ImportDepartment[];
  organizationFromFile?: {
    nombre: string;
    rfc?: string | null;
    razonSocial?: string | null;
    timezone?: string;
    baseCurrency?: string;
  };
  newOrganizationApplyAvailable: boolean;
  previewCreateNewOrganization: boolean;
};

/** Usuario creado en apply. */
export type CreatedImportUser = {
  userId: number;
  userName: string;
  email: string;
  noEmpleado?: string;
};

/** Fila que falló al persistir (colisión UNIQUE post-preview). */
export type ApplyImportFailure = { userName: string; reason: string };

/** Spec de rol "a medida" creado en apply. */
export type CustomImportRoleSpec = { templateRoleName: string; permissions: string[] };

/** Respuesta de la fase apply. */
export type ApplyImportResult = {
  created: number;
  skipped: number;
  createdUsers: CreatedImportUser[];
  appliedBy: bigint | number | string;
  failures: ApplyImportFailure[];
  createdOrganization?: { id: string; nombre: string };
  bootstrapAdmin?: { userName: string; email: string; temporaryPassword: string };
  bootstrapAdminNotice?: string;
};
