import { apiClient, ApiClient } from "./index";

export interface DashboardStats {
  totalRunners: number;
  activeClients: number;
  openErrands: number;
  pendingKycReviews: number;
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

export async function getDashboardOverview(
  client: ApiClient = apiClient,
): Promise<DashboardOverview> {
  return client.get<DashboardOverview>("/api/admin/dashboard/overview");
}
