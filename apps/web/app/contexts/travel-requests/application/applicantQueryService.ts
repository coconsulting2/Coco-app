/**
 * @module applicantQueryService
 * @description Use-cases de consulta del slice travel-requests.
 */
import Applicant from "~/contexts/travel-requests/infrastructure/applicantModel.js";

export async function listCompletedRequests(userId: number): Promise<unknown[]> {
  return Applicant.getCompletedRequests(userId);
}

export async function listActiveRequests(userId: number): Promise<unknown[]> {
  return Applicant.getApplicantRequests(userId);
}

export async function listDrafts(userId: number): Promise<unknown[]> {
  const all = (await Applicant.getApplicantRequests(userId)) as Array<{
    status?: string;
  }> | null;
  if (!Array.isArray(all)) return [];
  return all.filter((r) => {
    const status = String(r.status ?? "").toLowerCase();
    return status === "borrador" || status === "draft";
  });
}

export async function getRequestDetail(requestId: number): Promise<unknown> {
  return Applicant.getApplicantRequest(requestId);
}

export async function getCostCenterForUser(
  userId: number,
): Promise<{ department_name: string; costs_center: string | null } | undefined> {
  return Applicant.findCostCenterByUserId(userId);
}
