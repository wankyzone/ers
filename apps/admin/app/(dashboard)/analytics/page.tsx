"use client";

import { useEffect, useMemo, useState } from "react";

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
import {
  getAnalyticsOverview,
  type AnalyticsRange,
} from "@/lib/api/analytics";

const RANGE_OPTIONS: AnalyticsRange[] = ["7d", "30d", "90d"];

function formatNumber(value: number): string {
  return value.toLocaleString();
}

function formatCurrency(value: number): string {
  return `₦${value.toLocaleString()}`;
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function getBarWidth(value: number, maximum: number): string {
  if (maximum <= 0 || value <= 0) {
    return "0%";
  }

  return `${Math.max(4, (value / maximum) * 100)}%`;
}

export default function AnalyticsPage() {
  const api = useApi();

  const [range, setRange] = useState<AnalyticsRange>("30d");

  const { data, error, isLoading, run } = useAsync(
    () => getAnalyticsOverview(range, api),
    { executeOnMount: false },
  );

  useEffect(() => {
    void run();
  }, [run, range]);

  const overview = data?.overview;

  const maxErrandVolume = useMemo(
    () =>
      Math.max(
        ...(data?.trends.errands.map((item) => item.total) ?? [0]),
        1,
      ),
    [data],
  );

  const maxUserGrowth = useMemo(
    () =>
      Math.max(
        ...(data?.trends.users.map((item) => item.users) ?? [0]),
        1,
      ),
    [data],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            Monitor marketplace performance, growth, and operational trends.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setRange(option)}
              className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                range === option
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Loading analytics...
          </CardContent>
        </Card>
      )}

      {error && !isLoading && (
        <Card>
          <CardHeader>
            <CardTitle>Unable to load analytics</CardTitle>
            <CardDescription>
              The analytics service returned an error.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">{error.message}</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && overview && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total users</CardDescription>
                <CardTitle className="text-2xl">
                  {formatNumber(overview.totalUsers)}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Clients</CardDescription>
                <CardTitle className="text-2xl">
                  {formatNumber(overview.totalClients)}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Runners</CardDescription>
                <CardTitle className="text-2xl">
                  {formatNumber(overview.totalRunners)}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Errands</CardDescription>
                <CardTitle className="text-2xl">
                  {formatNumber(overview.totalErrands)}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Revenue</CardTitle>
                <CardDescription>
                  Platform commission for the selected period.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">
                  {formatCurrency(overview.revenue)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Success rate</CardTitle>
                <CardDescription>
                  Confirmed errands relative to total errands.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <p className="text-3xl font-semibold">
                  {overview.successRate.toFixed(2)}%
                </p>
                <Badge variant="secondary">
                  {formatNumber(overview.completedErrands)} completed
                </Badge>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Errand funnel</CardTitle>
                <CardDescription>
                  Movement through the canonical errand lifecycle.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {Object.entries(data.funnel).map(([stage, value]) => (
                  <div key={stage} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize">{stage}</span>
                      <span className="font-medium">
                        {formatNumber(value)}
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: getBarWidth(
                            value,
                            Math.max(data.funnel.created, 1),
                          ),
                        }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Errand activity</CardTitle>
                <CardDescription>
                  Daily errand volume during the selected period.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                {data.trends.errands.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No errand activity for this period.
                  </p>
                ) : (
                  data.trends.errands.map((item) => (
                    <div key={item.date} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span>{formatDate(item.date)}</span>
                        <span>{formatNumber(item.total)}</span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{
                            width: getBarWidth(
                              item.total,
                              maxErrandVolume,
                            ),
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>New user activity</CardTitle>
              <CardDescription>
                New client, runner, and profile creation by day.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              {data.trends.users.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No new users for this period.
                </p>
              ) : (
                data.trends.users.map((item) => (
                  <div key={item.date} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span>{formatDate(item.date)}</span>
                      <span>
                        {formatNumber(item.users)} users ·{" "}
                        {formatNumber(item.clients)} clients ·{" "}
                        {formatNumber(item.runners)} runners
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: getBarWidth(
                            item.users,
                            maxUserGrowth,
                          ),
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!isLoading && !error && !overview && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No analytics data available.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
