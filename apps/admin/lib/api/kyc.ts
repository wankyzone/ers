import { apiClient, type ApiClient } from "./client";

export type KycStatus = "pending" | "approved" | "rejected";

export interface KycSubmission {
  id: string;
  user_id?: string;
  full_name?: string | null;
  phone?: string | null;
  status: KycStatus;
  created_at?: string | null;
  updated_at?: string | null;
  bvn?: string | null;
  bank_code?: string | null;
  account_number?: string | null;
  account_name?: string | null;
  rejection_reason?: string | null;
  rejected_at?: string | null;
  [key: string]: unknown;
}

export interface KycDocumentMap {
  nin: string | null;
  proofOfAddress: string | null;
  selfie: string | null;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface KycActionResult {
  success: boolean;
  message: string;
  data: KycSubmission;
}

export async function getPendingKycs(
  client: ApiClient = apiClient,
): Promise<KycSubmission[]> {
  const response = await client.get<ApiEnvelope<KycSubmission[]>>(
    "/api/admin/kyc",
  );

  return response.data;
}

export async function getKycDocuments(
  kycId: string,
  client: ApiClient = apiClient,
): Promise<KycDocumentMap> {
  const response = await client.get<ApiEnvelope<KycDocumentMap>>(
    `/api/admin/kyc/${kycId}/documents`,
  );

  return response.data;
}

export async function approveKyc(
  kycId: string,
  client: ApiClient = apiClient,
): Promise<KycActionResult> {
  const response = await client.post<KycActionResult>(
    `/api/admin/kyc/${kycId}/approve`,
  );

  return response;
}

export async function rejectKyc(
  kycId: string,
  reason: string,
  client: ApiClient = apiClient,
): Promise<KycActionResult> {
  const response = await client.post<KycActionResult>(
    `/api/admin/kyc/${kycId}/reject`,
    { reason },
  );

  return response;
}
