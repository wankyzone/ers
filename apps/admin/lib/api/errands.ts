import { apiClient, type ApiClient } from "./client";

export interface ErrandEventRecord {
  id: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorId: string | null;
  actorRole: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string | null;
}

export interface ErrandRecord {
  id: string;
  title: string | null;
  description: string | null;
  status: string | null;
  price: number;
  payoutAmount: number;
  clientId: string | null;
  clientName: string | null;
  clientEmail: string | null;
  assignedRunnerId: string | null;
  runnerName: string | null;
  runnerEmail: string | null;
  runnerVerified: boolean;
  runnerEarnings: number;
  escrowStatus: string | null;
  createdAt: string | null;
  assignedAt: string | null;
  completedAt: string | null;
  confirmedAt: string | null;
}

export interface ErrandDetailRecord extends ErrandRecord {
  client: {
    id: string | null;
    email: string | null;
  } | null;
  runner: {
    id: string | null;
    name: string | null;
    email: string | null;
    verified: boolean;
    totalEarnings: number;
  } | null;
  events: ErrandEventRecord[];
}

export interface ErrandListResponse {
  errands: ErrandRecord[];
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

export type ErrandStatusFilter = "all" | string;

export async function getErrandList(
  params: {
    search?: string;
    status?: ErrandStatusFilter;
    page?: number;
    limit?: number;
  } = {},
  client: ApiClient = apiClient,
): Promise<ErrandListResponse> {
  const response = await client.get<ApiEnvelope<ErrandListResponse>>("/api/admin/errands", {
    params: {
      search: params.search ?? "",
      status: params.status ?? "all",
      page: params.page ?? 1,
      limit: params.limit ?? 20,
    },
  });

  return response.data;
}

export async function getErrandById(
  errandId: string,
  client: ApiClient = apiClient,
): Promise<ErrandDetailRecord> {
  const response = await client.get<ApiEnvelope<ErrandDetailRecord>>(`/api/admin/errands/${errandId}`);

  return response.data;
}
