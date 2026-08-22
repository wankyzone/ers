"use client";

import Link from "next/link";
import {
  ActivityIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  CircleDollarSignIcon,
  ClipboardListIcon,
  Clock3Icon,
  ShieldAlertIcon,
  UsersIcon,
  WalletCardsIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useApi } from "@/hooks/useApi";
import { useAsync } from "@/hooks/useAsync";
import { getDashboardOverview, getSystemHealth } from "@/lib/api/dashboard";

const quickActions = [
  {
    label: "Review KYC",
    description: "Review pending runner verification",
    href: "/kyc",
    icon: ShieldAlertIcon,
  },
  {
    label: "View Errands",
    description: "Monitor active errands",
    href: "/errands",
    icon: ClipboardListIcon,
  },
  {
    label: "Manage Runners",
    description: "Review runner operations",
    href: "/runners",
    icon: UsersIcon,
  },
] as const;

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-NG").format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

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

function formatActivityTime(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function DashboardPage() {
  const api = useApi();

  const { data, error, isLoading } = useAsync(() =>
    getDashboardOverview(api),
  );

  const {
    data: health,
    error: healthError,
    isLoading: healthLoading,
  } = useAsync(() => getSystemHealth(api));

  const stats = data?.stats ?? {
    totalUsers: 0,
    totalClients: 0,
    totalRunners: 0,
    activeClients: 0,
    openErrands: 0,
    pendingKycReviews: 0,
    completedErrands: 0,
    revenue: 0,
    walletBalance: 0,
  };

  const recentActivity = data?.recentActivity ?? [];

  const primaryMetrics = [
    {
      label: "Total Users",
      value: formatNumber(stats.totalUsers),
      description: "Registered accounts",
      icon: UsersIcon,
    },
    {
      label: "Clients",
      value: formatNumber(stats.totalClients),
      description: "Client accounts",
      icon: UsersIcon,
    },
    {
      label: "Runners",
      value: formatNumber(stats.totalRunners),
      description: "Registered runners",
      icon: UsersIcon,
    },
    {
      label: "Open Errands",
      value: formatNumber(stats.openErrands),
      description: "Created or accepted",
      icon: ClipboardListIcon,
    },
  ];

  const operationalMetrics = [
    {
      label: "Active Clients",
      value: formatNumber(stats.activeClients),
      description: "Active in the last 30 days",
      icon: ActivityIcon,
    },
    {
      label: "Pending KYC",
      value: formatNumber(stats.pendingKycReviews),
      description: "Awaiting review",
      icon: ShieldAlertIcon,
    },
    {
      label: "Completed Errands",
      value: formatNumber(stats.completedErrands),
      description: "Successfully completed",
      icon: CheckCircle2Icon,
    },
    {
      label: "Revenue",
      value: formatCurrency(stats.revenue),
      description: "Platform commission",
      icon: CircleDollarSignIcon,
    },
  ];

  const pipeline = [
    {
      label: "Created",
      value: stats.errandPipeline?.created ?? 0,
    },
    {
      label: "Accepted",
      value: stats.errandPipeline?.accepted ?? 0,
    },
    {
      label: "Completed",
      value: stats.errandPipeline?.completed ?? 0,
    },
    {
      label: "Confirmed",
      value: stats.errandPipeline?.confirmed ?? 0,
    },
  ];

  return (
    <div className="space-y-8">
      <section
        aria-labelledby="dashboard-title"
        className="flex flex-col gap-2"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1
              id="dashboard-title"
              className="text-2xl font-semibold tracking-tight sm:text-3xl"
            >
              ERS Admin Dashboard
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Monitor platform operations, users, errands, and revenue from one
              place.
            </p>
          </div>

          <Badge variant="outline" className="w-fit gap-2 rounded-full px-3 py-1">
            <span className="size-2 rounded-full bg-emerald-500" />
            Live operations
          </Badge>
        </div>
      </section>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">
              Unable to load dashboard data. {error.message}
            </p>
          </CardContent>
        </Card>
      )}

      <section aria-label="Primary metrics">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {primaryMetrics.map((metric) => {
            const Icon = metric.icon;

            return (
              <Card key={metric.label}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <CardDescription>{metric.label}</CardDescription>
                  <Icon className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tracking-tight">
                    {isLoading ? "—" : metric.value}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {metric.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section aria-label="Operational metrics">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {operationalMetrics.map((metric) => {
            const Icon = metric.icon;

            return (
              <Card key={metric.label}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <CardDescription>{metric.label}</CardDescription>
                  <Icon className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tracking-tight">
                    {isLoading ? "—" : metric.value}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {metric.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section
        aria-label="System status and errand pipeline"
        className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>System Health</CardTitle>
                <CardDescription>
                  Current API availability
                </CardDescription>
              </div>

              <ActivityIcon className="size-5 text-muted-foreground" />
            </div>
          </CardHeader>

          <CardContent>
            {healthLoading ? (
              <div className="flex items-center gap-3">
                <span className="size-3 rounded-full bg-muted" />
                <span className="text-sm text-muted-foreground">
                  Checking system health...
                </span>
              </div>
            ) : healthError ? (
              <div className="flex items-center gap-3">
                <span className="size-3 rounded-full bg-destructive" />
                <div>
                  <p className="font-medium text-destructive">Unhealthy</p>
                  <p className="text-xs text-muted-foreground">
                    Unable to verify API health.
                  </p>
                </div>
              </div>
            ) : health?.status === "ok" ? (
              <div className="flex items-center gap-3">
                <span className="size-3 rounded-full bg-emerald-500" />
                <div>
                  <p className="font-medium">Healthy</p>
                  <p className="text-xs text-muted-foreground">
                    Core admin API is responding normally.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="size-3 rounded-full bg-destructive" />
                <p className="font-medium text-destructive">Unhealthy</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Errand Pipeline</CardTitle>
            <CardDescription>
              Current errands across the operational lifecycle.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {pipeline.map((stage) => (
                <div
                  key={stage.label}
                  className="rounded-2xl border border-border bg-muted/40 p-4"
                >
                  <p className="text-xs font-medium text-muted-foreground">
                    {stage.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {formatNumber(stage.value)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section
        aria-label="Activity and quick actions"
        className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]"
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Latest operational events across ERS.
                </CardDescription>
              </div>
              <ActivityIcon className="size-5 text-muted-foreground" />
            </div>
          </CardHeader>

          <CardContent>
            {error ? (
              <p className="text-sm text-destructive">
                Unable to load recent activity.
              </p>
            ) : isLoading ? (
              <p className="text-sm text-muted-foreground">
                Loading recent activity...
              </p>
            ) : recentActivity.length > 0 ? (
              <div className="divide-y divide-border">
                {recentActivity.map((activity) => (
                  <div
                    key={String(activity.id) || JSON.stringify(activity)}
                    className="flex items-start gap-3 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="mt-1 grid size-8 shrink-0 place-items-center rounded-full bg-muted">
                      <Clock3Icon className="size-4 text-muted-foreground" />
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {formatActivityMessage(
                          activity as Record<string, unknown>,
                        )}
                      </p>

                      {typeof activity.createdAt === "string" && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatActivityTime(activity.createdAt)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center">
                <p className="text-sm font-medium">No recent activity</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Operational events will appear here as ERS activity occurs.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Jump directly into operational workflows.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-2">
            {quickActions.map((action) => {
              const Icon = action.icon;

              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group flex items-center gap-3 rounded-2xl border border-border p-3 transition-colors hover:bg-muted"
                >
                  <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted">
                    <Icon className="size-4 text-muted-foreground" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{action.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {action.description}
                    </p>
                  </div>

                  <ArrowRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </section>

      <section aria-label="Wallet balance">
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-muted">
                <WalletCardsIcon className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Wallet Balance</p>
                <p className="text-xs text-muted-foreground">
                  Aggregate balance across user wallets
                </p>
              </div>
            </div>

            <p className="text-2xl font-semibold tracking-tight">
              {isLoading ? "—" : formatCurrency(stats.walletBalance)}
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
