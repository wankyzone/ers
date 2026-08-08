"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useApi } from "@/hooks/useApi";
import { useAsync } from "@/hooks/useAsync";
import { getDashboardOverview } from "@/lib/api/dashboard";

const quickActions = [
  { label: "Review KYC", href: "/kyc" },
  { label: "View Errands", href: "/errands" },
  { label: "Manage Runners", href: "/runners" },
] as const;

function formatActivityMessage(activity: Record<string, unknown>) {
  if (typeof activity.action === "string") {
    return `${activity.action}${activity.entity ? ` ${activity.entity}` : ""}`.trim();
  }

  if (typeof activity.eventType === "string") {
    return activity.eventType;
  }

  if (typeof activity.source === "string") {
    return activity.source;
  }

  return "Recent activity event";
}

export default function DashboardPage() {
  const api = useApi();
  const { data, error, isLoading } = useAsync(() => getDashboardOverview(api));

  const stats = data?.stats ?? {
    totalRunners: 0,
    activeClients: 0,
    openErrands: 0,
    pendingKycReviews: 0,
  };

  const metrics = useMemo(
    () => [
      { label: "Total Runners", value: stats.totalRunners.toString() },
      { label: "Active Clients", value: stats.activeClients.toString() },
      { label: "Open Errands", value: stats.openErrands.toString() },
      { label: "Pending KYC Reviews", value: stats.pendingKycReviews.toString() },
    ],
    [stats],
  );

  const recentActivity = data?.recentActivity ?? [];

  return (
    <div>
      <section aria-labelledby="dashboard-title">
        <h1 id="dashboard-title">ERS Admin Dashboard</h1>
        <p>Welcome to the ERS administration portal.</p>
      </section>

      <section aria-label="Dashboard metrics">
        {error ? (
          <p className="text-destructive">Unable to load dashboard stats. {error.message}</p>
        ) : isLoading ? (
          <p>Loading dashboard metrics...</p>
        ) : null}

        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader>
              <CardTitle>{metric.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{metric.value}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section aria-labelledby="recent-activity-title">
        <h2 id="recent-activity-title">Recent Activity</h2>
        <Card>
          <CardContent>
            {error ? (
              <p className="text-destructive">Unable to load recent activity.</p>
            ) : isLoading ? (
              <p>Loading recent activity...</p>
            ) : (
              <ul>
                {recentActivity.length > 0 ? (
                  recentActivity.map((activity) => (
                    <li key={String(activity.id) || JSON.stringify(activity)}>
                      {formatActivityMessage(activity as Record<string, unknown>)}
                    </li>
                  ))
                ) : (
                  <li>No recent activity available.</li>
                )}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="quick-actions-title">
        <h2 id="quick-actions-title">Quick Actions</h2>
        <Card>
          <CardContent>
            <ul>
              {quickActions.map((action) => (
                <li key={action.href}>
                  <Link href={action.href}>{action.label}</Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
