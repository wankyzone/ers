import { apiClient, type ApiClient } from "./client";

export type ClientStatusFilter = "all" | "active" | "suspended";
export type ClientAccountStatusFilter = "all" | "verified" | "unverified";

export interface ClientRecord {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: string | null;
  verified: boolean;
  status: "active" | "suspended";
  kyc_verified: boolean;
  created_at: string | null;
  updated_at: string | null;
  account_status: "verified" | "unverified" | "pending";
  total_errands: number;
  total_spent: number;
  wallet_balance: number;
}

export interface ClientListResponse {
  clients: ClientRecord[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ClientActivityRecord {
  id: string;
  errand_id: string | null;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  created_at: string | null;
  metadata: Record<string, unknown> | null;
}

export interface ClientActivityResponse {
  activities: ClientActivityRecord[];
  totalCount: number;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

export async function getClientList(
  params: {
    search?: string;
    status?: ClientStatusFilter;
    accountStatus?: ClientAccountStatusFilter;
    page?: number;
    limit?: number;
  } = {},
  client: ApiClient = apiClient,
): Promise<ClientListResponse> {
  const response = await client.get<ApiEnvelope<ClientListResponse>>("/api/admin/clients", {
    params: {
      search: params.search ?? "",
      status: params.status ?? "all",
      accountStatus: params.accountStatus ?? "all",
      page: params.page ?? 1,
      limit: params.limit ?? 10,
    },
  });

  return response.data;
}

export async function getClientById(
  clientId: string,
  client: ApiClient = apiClient,
): Promise<ClientRecord> {
  const response = await client.get<ApiEnvelope<ClientRecord>>(`/api/admin/clients/${clientId}`);

  return response.data;
}

export async function getClientActivity(
  clientId: string,
  params: {
    page?: number;
    limit?: number;
  } = {},
  client: ApiClient = apiClient,
): Promise<ClientActivityResponse> {
  const response = await client.get<ApiEnvelope<ClientActivityResponse>>(
    `/api/admin/clients/${clientId}/activity`,
    {
      params: {
        page: params.page ?? 1,
        limit: params.limit ?? 20,
      },
    },
  );

  return response.data;
}

export async function suspendClient(
  clientId: string,
  client: ApiClient = apiClient,
): Promise<{ success: boolean; message: string; data: ClientRecord }> {
  const response = await client.post<{ success: boolean; message: string; data: ClientRecord }>(
    `/api/admin/clients/${clientId}/suspend`,
  );

  return response;
}

export async function activateClient(
  clientId: string,
  client: ApiClient = apiClient,
): Promise<{ success: boolean; message: string; data: ClientRecord }> {
  const response = await client.post<{ success: boolean; message: string; data: ClientRecord }>(
    `/api/admin/clients/${clientId}/activate`,
  );

  return response;
}
