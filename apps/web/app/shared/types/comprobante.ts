/**
 * @module shared/types/comprobante
 * @description Tipos compartidos del flujo de subida/re-subida de comprobante.
 * Módulo PURO (sin runtime ni server-code) para que tanto la UI cliente
 * (`ExpensesForm`) como las rutas y su handler server (`subir-comprobante.server`)
 * lo importen sin arrastrar `*.server` al bundle de cliente.
 */

export type PolicyPreviewResult = {
  exceeded: boolean;
  policyId: number | null;
  capId: number | null;
  capAmount: number | null;
  capUnit: string | null;
  currency: string;
  excessTotal: number;
  message: string;
};

export type SubmitComprobanteActionResult =
  | { ok: true; intent: "previewPolicy"; preview: PolicyPreviewResult }
  | { ok: true; intent: "submit"; receiptId: number; isInternational: boolean }
  | { ok: true; intent: "policy-exception:create"; exceptionId: number }
  | { ok: false; intent: string; error: string; code?: string };
