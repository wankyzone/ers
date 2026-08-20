import { apiClient, ApiClient } from "./index";

export interface ErrandPipelineCounts {
  created: number;
  accepted: number;
  completed: number;
  confirmed: number;
}

export interface DashboardStats {
  totalUsers: number;
  totalClients: number;
  totalRunners: number;
  activeClients: number;
  openErrands: number;
  pendingKycReviews: number;
  completedErrands: number;
  revenue: number;
  walletBalance: number;
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

interface DashboardOverviewResponse {
  success: boolean;
  data: DashboardOverview;
}

export async function getDashboardOverview(
  client: ApiClient = apiClient,
): Promise<DashboardOverview> {
  const response = await client.get<DashboardOverviewResponse>(
    "/api/admin/dashboard/overview",
  );

  return response.data;
}
