import { apiClient, type ApiClient } from "./client";

export type AdminNotificationType = "action" | "info";

export interface AdminNotification {
  id: string;
  type: AdminNotificationType;
  title: string;
  description: string;
  href: string;
  count: number;
  createdAt: string | null;
}

export interface AdminNotificationsResponse {
  notifications: AdminNotification[];
  activeAlertCount: number;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

export async function getAdminNotifications(
  client: ApiClient = apiClient,
): Promise<AdminNotificationsResponse> {
  const response = await client.get<ApiEnvelope<AdminNotificationsResponse>>(
    "/api/admin/notifications",
  );

  return response.data;
}
