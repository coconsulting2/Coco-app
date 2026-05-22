// @ts-nocheck — bulk-converted legacy; typed properly is M9 follow-up
import { Duffel } from "@duffel/api";

/**
 * Cliente Duffel (sandbox/producción según token).
 * @returns {Duffel}
 */
export function createDuffelClient() {
  const token = process.env.DUFFEL_ACCESS_TOKEN;
  if (!token) {
    throw new Error("DUFFEL_ACCESS_TOKEN is not configured");
  }
  return new Duffel({ token });
}
