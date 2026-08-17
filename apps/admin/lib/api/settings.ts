import { apiClient, type ApiClient } from "./client";

export interface AdminProfile {
  id: string | null;
  email: string | null;
  role: string | null;
  date_of_birth: string | null;
  address: string | null;
  account_number: string | null;
  account_name: string | null;
  emergency_contact: string | null;
  verified: boolean;
  created_at: string | null;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

export async function getAdminProfile(
  client: ApiClient = apiClient,
): Promise<AdminProfile> {
  const response = await client.get<ApiEnvelope<AdminProfile>>(
    "/api/admin/settings/profile",
  );

  return response.data;
}

export async function updateAdminProfile(
  payload: Partial<AdminProfile>,
  client: ApiClient = apiClient,
): Promise<AdminProfile> {
  const response = await client.patch<ApiEnvelope<AdminProfile>>(
    "/api/admin/settings/profile",
    payload,
  );

  return response.data;
}
