"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useApi } from "@/hooks/useApi";
import { useAsync } from "@/hooks/useAsync";
import {
  activateRunner,
  getRunnerList,
  suspendRunner,
  type RunnerRecord,
  type RunnerStatusFilter,
  type RunnerVerificationFilter,
} from "@/lib/api/runners";

function formatDate(value?: string | null): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getStatusVariant(status: RunnerRecord["status"]) {
  return status === "active" ? "default" : "secondary";
}

function getVerificationVariant(verified: boolean) {
  return verified ? "default" : "secondary";
}

export default function RunnersPage() {
  const api = useApi();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<RunnerStatusFilter>("all");
  const [verificationFilter, setVerificationFilter] = useState<RunnerVerificationFilter>("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, error, isLoading, run } = useAsync(() =>
    getRunnerList({
      search,
      status: statusFilter,
      verified: verificationFilter,
      page,
      limit: 10,
    }, api),
  );

  const runners = data?.runners ?? [];
  const totalPages = data?.totalPages ?? 1;

  const selectedRunner = useMemo(() => {
    if (!selectedId) return runners[0] ?? null;
    return runners.find((runner) => runner.id === selectedId) ?? runners[0] ?? null;
  }, [selectedId, runners]);

  async function toggleRunnerState(runnerId: string, nextStatus: "active" | "suspended") {
    setActionMessage(null);
    setActionError(null);

    try {
      const response =
        nextStatus === "active"
          ? await activateRunner(runnerId, api)
          : await suspendRunner(runnerId, api);

      setActionMessage(response.message);
      await run();
    } catch (runnerError) {
      setActionError(
        runnerError instanceof Error ? runnerError.message : "Unable to update runner status.",
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Runner Management</h1>
          <p className="text-sm text-muted-foreground">
            Monitor verification status, availability, and operational state for active runners.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Search and narrow the runner roster by status and verification state.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Input
              type="search"
              value={search}
              placeholder="Search by name or email"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />

            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as RunnerStatusFilter);
                setPage(1);
              }}
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
            >
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>

            <select
              value={verificationFilter}
              onChange={(event) => {
                setVerificationFilter(event.target.value as RunnerVerificationFilter);
                setPage(1);
              }}
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
            >
              <option value="all">All verification</option>
              <option value="verified">Verified</option>
              <option value="unverified">Unverified</option>
            </select>

            <Button
              variant="secondary"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setVerificationFilter("all");
                setPage(1);
                void run();
              }}
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Runner roster</CardTitle>
            <CardDescription>{data?.totalCount ?? 0} runners match the current filters.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-0 pb-3">
            {error ? (
              <p className="px-6 text-sm text-destructive">Unable to load runners. {error.message}</p>
            ) : isLoading ? (
              <p className="px-6 text-sm text-muted-foreground">Loading runners…</p>
            ) : runners.length === 0 ? (
              <p className="px-6 text-sm text-muted-foreground">No runners match the selected criteria.</p>
            ) : (
              <div className="divide-y divide-border">
                {runners.map((runner) => (
                  <button
                    key={runner.id}
                    type="button"
                    onClick={() => setSelectedId(runner.id)}
                    className={`flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition-colors hover:bg-muted/50 ${
                      selectedRunner?.id === runner.id ? "bg-muted/60" : ""
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{runner.name ?? "Unnamed runner"}</span>
                        <Badge variant={getStatusVariant(runner.status)}>{runner.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{runner.email ?? "No email on file"}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant={getVerificationVariant(runner.verified)}>
                        {runner.verified ? "Verified" : "Unverified"}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between px-6 pt-3">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {data?.page ?? page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || isLoading}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{selectedRunner ? selectedRunner.name ?? "Runner details" : "Runner details"}</CardTitle>
            <CardDescription>
              {selectedRunner ? `ID: ${selectedRunner.id}` : "No runner selected"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedRunner ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Verification</p>
                    <Badge variant={getVerificationVariant(selectedRunner.verified)}>
                      {selectedRunner.verificationStatus}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Operational state</p>
                    <Badge variant={getStatusVariant(selectedRunner.status)}>{selectedRunner.status}</Badge>
                  </div>
                </div>

                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Email</dt>
                    <dd className="text-right">{selectedRunner.email ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Role</dt>
                    <dd className="text-right">{selectedRunner.role ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Created</dt>
                    <dd className="text-right">{formatDate(selectedRunner.createdAt)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Earnings</dt>
                    <dd className="text-right">{selectedRunner.totalEarnings.toLocaleString()}</dd>
                  </div>
                </dl>

                <div className="flex gap-2 pt-2">
                  {selectedRunner.status === "active" ? (
                    <Button
                      variant="secondary"
                      onClick={() => toggleRunnerState(selectedRunner.id, "suspended")}
                    >
                      Suspend runner
                    </Button>
                  ) : (
                    <Button onClick={() => toggleRunnerState(selectedRunner.id, "active")}>
                      Activate runner
                    </Button>
                  )}
                </div>

                {actionMessage ? <p className="text-sm text-success">{actionMessage}</p> : null}
                {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Select a runner to view details.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
