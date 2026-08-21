import { apiClient, type ApiClient } from "./client";

export type AnalyticsRange = "7d" | "30d" | "90d";

export interface AnalyticsOverviewStats {
  totalUsers: number;
  totalClients: number;
  totalRunners: number;
  totalErrands: number;
  completedErrands: number;
  confirmedErrands: number;
  revenue: number;
  successRate: number;
}

export interface AnalyticsErrandTrend {
  date: string;
  total: number;
  completed: number;
  confirmed: number;
}

export interface AnalyticsUserGrowth {
  date: string;
  clients: number;
  runners: number;
  users: number;
}

export interface AnalyticsFunnel {
  created: number;
  accepted: number;
  completed: number;
  confirmed: number;
}

export interface AnalyticsOverview {
  range: AnalyticsRange;
  startDate: string;
  overview: AnalyticsOverviewStats;
  trends: {
    errands: AnalyticsErrandTrend[];
    users: AnalyticsUserGrowth[];
  };
  funnel: AnalyticsFunnel;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

export async function getAnalyticsOverview(
  range: AnalyticsRange = "30d",
  client: ApiClient = apiClient,
): Promise<AnalyticsOverview> {
  const response = await client.get<ApiEnvelope<AnalyticsOverview>>(
    "/api/admin/analytics/overview",
    {
      params: {
        range,
      },
    },
  );

  return response.data;
}
