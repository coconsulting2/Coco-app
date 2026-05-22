/**
 * @module @coco/integrations/duffel/client
 * @description Singleton del cliente Duffel SDK. Requiere `DUFFEL_ACCESS_TOKEN`
 * en el entorno.
 */
import { Duffel } from "@duffel/api";

let cached: Duffel | null = null;

export function createDuffelClient(): Duffel {
  if (cached) return cached;
  const token = process.env.DUFFEL_ACCESS_TOKEN;
  if (!token) {
    throw new Error("DUFFEL_ACCESS_TOKEN is not configured");
  }
  cached = new Duffel({ token });
  return cached;
}

/** Reset usado solo en tests. */
export function __resetDuffelClient(): void {
  cached = null;
}
