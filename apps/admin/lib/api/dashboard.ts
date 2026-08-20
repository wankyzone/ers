import { apiClient, ApiClient } from "./index";

export interface ErrandPipelineCounts {
  created: number;
  accepted: number;
  completed: number;
  confirmed: number;
}

export interface DashboardStats {
  totalRunners: number;
  activeClients: number;
  openErrands: number;
  pendingKycReviews: number;
  errandPipeline?: ErrandPipelineCounts;
}

export interface DashboardActivityItem {
  id: string;
  source: string;
  createdAt: string;
  [key: string]: unknown;
}

export interface DashboardOverview {
  stats: DashboardStats;
  recentActivity: DashboardActivityItem[];
}

export interface SystemHealth {
  status: "ok" | string;
}

interface DashboardOverviewResponse {
  success: boolean;
  data: DashboardOverview;
}

interface SystemHealthResponse {
  success: boolean;
  data: SystemHealth;
}

export async function getDashboardOverview(
  client: ApiClient = apiClient,
): Promise<DashboardOverview> {
  const response = await client.get<DashboardOverviewResponse>(
    "/api/admin/dashboard/overview",
  );

  return response.data;
}

export async function getSystemHealth(
  client: ApiClient = apiClient,
): Promise<SystemHealth> {
  const response = await client.get<SystemHealthResponse>(
    "/api/admin/dashboard/health",
  );

  return response.data;
}
