/**
 * @module polizaCatalogService
 * @description Resuelve COMP_CODE y cuentas GL desde el catálogo contable por organización (RF-74),
 * con fallback a los defaults de `accountingCatalogs.ts`.
 */
import { GL_ACCOUNTS, SOCIEDAD_DEFAULT } from "@coco/shared-config/accountingCatalogs";

/** Cuentas GL resueltas para la construcción de pólizas. */
export type GlCatalogResolved = {
  anticipo: string;
  cxp: string;
  gasto: string;
  iva: string;
};

/** Cuenta del catálogo contable (chart of accounts) de la organización. */
export type ChartAccountLike = {
  accountCode: string;
  accountName?: string;
  accountType?: string | null;
  active?: boolean;
};

/** Sociedad contable (COMP_CODE SAP) de la organización. */
export type AccountingSocietyLike = {
  code: string;
};

/** Request con el contexto de organización necesario para resolver catálogos. */
export type RequestWithCatalogContext = {
  organization?: {
    chartOfAccounts?: ChartAccountLike[] | null;
    accountingSocieties?: AccountingSocietyLike[] | null;
  } | null;
} | null | undefined;

const sliceCode = (s: unknown): string => String(s ?? "").trim().slice(0, 10);

export function resolveGlCatalogFromAccounts(
  accounts: ChartAccountLike[] | null | undefined,
): GlCatalogResolved {
  const list = (accounts || []).filter((a) => a.active !== false);
  const out: GlCatalogResolved = {
    anticipo: GL_ACCOUNTS.ANTICIPO,
    cxp: GL_ACCOUNTS.CUENTA_POR_PAGAR_EMPLEADO,
    gasto: GL_ACCOUNTS.GASTO_DE_VIAJE,
    iva: GL_ACCOUNTS.IVA_ACREDITABLE,
  };
  for (const a of list) {
    const c = sliceCode(a.accountCode);
    if (c === GL_ACCOUNTS.ANTICIPO) out.anticipo = c;
    else if (c === GL_ACCOUNTS.CUENTA_POR_PAGAR_EMPLEADO) out.cxp = c;
    else if (c === GL_ACCOUNTS.GASTO_DE_VIAJE) out.gasto = c;
    else if (c === GL_ACCOUNTS.IVA_ACREDITABLE) out.iva = c;
  }
  for (const a of list) {
    const t = String(a.accountType || "").trim();
    const c = sliceCode(a.accountCode);
    if (t === "Anticipo") out.anticipo = c;
    else if (t === "CxpEmpleado") out.cxp = c;
    else if (t === "GastoViaje") out.gasto = c;
    else if (t === "Iva") out.iva = c;
  }
  return out;
}

export function resolveGlCatalog(request: RequestWithCatalogContext): GlCatalogResolved {
  return resolveGlCatalogFromAccounts(request?.organization?.chartOfAccounts);
}

/** COMP_CODE SAP C(4) a partir de las sociedades de la organización. */
export function resolveCompCodeFromSocieties(
  societies: AccountingSocietyLike[] | null | undefined,
): string {
  const list = [...(societies || [])].sort((a, b) =>
    String(a.code).localeCompare(String(b.code)),
  );
  if (!list.length) return String(SOCIEDAD_DEFAULT).trim().slice(0, 4);
  const first = String(list[0]?.code ?? "").trim();
  return first.slice(0, 4) || String(SOCIEDAD_DEFAULT).trim().slice(0, 4);
}

export function resolveCompCode(request: RequestWithCatalogContext): string {
  return resolveCompCodeFromSocieties(request?.organization?.accountingSocieties);
}

/**
 * Cuentas cuya línea Debe requiere centro de costos (gasto P&L).
 */
export function costCenterRequiredAccountsFor(gl: GlCatalogResolved): Set<string> {
  return new Set([gl.gasto]);
}
