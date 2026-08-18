import { apiClient, type ApiClient } from "./client";

export type RunnerStatusFilter = "all" | "active" | "suspended";
export type RunnerVerificationFilter = "all" | "verified" | "unverified";

export interface RunnerRecord {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  verified: boolean;
  verificationStatus: "verified" | "unverified";
  status: "active" | "suspended";
  isAvailable: boolean;
  totalEarnings: number;
  createdAt: string | null;
  updatedAt: string | null;
  lat: number | null;
  lng: number | null;
}

export interface RunnerListResponse {
  runners: RunnerRecord[];
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

export async function getRunnerList(
  params: {
    search?: string;
    status?: RunnerStatusFilter;
    verified?: RunnerVerificationFilter;
    page?: number;
    limit?: number;
  } = {},
  client: ApiClient = apiClient,
): Promise<RunnerListResponse> {
  const response = await client.get<ApiEnvelope<RunnerListResponse>>("/api/admin/runners", {
    params: {
      search: params.search ?? "",
      status: params.status ?? "all",
      verified: params.verified ?? "all",
      page: params.page ?? 1,
      limit: params.limit ?? 20,
    },
  });

  return response.data;
}

export async function getRunnerById(
  runnerId: string,
  client: ApiClient = apiClient,
): Promise<RunnerRecord> {
  const response = await client.get<ApiEnvelope<RunnerRecord>>(`/api/admin/runners/${runnerId}`);

  return response.data;
}

export async function suspendRunner(
  runnerId: string,
  client: ApiClient = apiClient,
): Promise<{ success: boolean; message: string; data: RunnerRecord }> {
  const response = await client.post<{ success: boolean; message: string; data: RunnerRecord }>(
    `/api/admin/runners/${runnerId}/suspend`,
  );

  return response;
}

export async function activateRunner(
  runnerId: string,
  client: ApiClient = apiClient,
): Promise<{ success: boolean; message: string; data: RunnerRecord }> {
  const response = await client.post<{ success: boolean; message: string; data: RunnerRecord }>(
    `/api/admin/runners/${runnerId}/activate`,
  );

  return response;
}
