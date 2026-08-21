import { apiClient, type ApiClient } from "./client";

export type ClientAccountStatusFilter =
  | "all"
  | "verified"
  | "unverified"
  | "pending";

export interface ClientRecord {
  id: string;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  role: string | null;
  verified: boolean;
  status: "active";
  kycVerified: boolean;
  createdAt: string | null;
  accountStatus: "verified" | "unverified" | "pending";
  totalErrands: number;
  walletBalance: number;
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
  errandId: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorId: string | null;
  actorRole: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ClientActivityResponse {
  activities: ClientActivityRecord[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

export async function getClientList(
  params: {
    search?: string;
    accountStatus?: ClientAccountStatusFilter;
    page?: number;
    limit?: number;
  } = {},
  client: ApiClient = apiClient,
): Promise<ClientListResponse> {
  const response = await client.get<ApiEnvelope<ClientListResponse>>(
    "/api/admin/clients",
    {
      params: {
        search: params.search ?? "",
        accountStatus: params.accountStatus ?? "all",
        page: params.page ?? 1,
        limit: params.limit ?? 20,
      },
    },
  );

  return response.data;
}

export async function getClientById(
  clientId: string,
  client: ApiClient = apiClient,
): Promise<ClientRecord> {
  const response = await client.get<ApiEnvelope<ClientRecord>>(
    `/api/admin/clients/${clientId}`,
  );

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
