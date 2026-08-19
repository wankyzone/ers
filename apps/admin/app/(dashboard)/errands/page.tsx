"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useApi } from "@/hooks/useApi";
import { useAsync } from "@/hooks/useAsync";
import {
  getErrandById,
  getErrandList,
  type ErrandDetailRecord,
} from "@/lib/api/errands";

const STATUS_OPTIONS = ["all", "created", "accepted", "completed", "confirmed"] as const;

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

function formatAmount(value?: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";

  return new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function getStatusVariant(status?: string | null): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "created":
      return "secondary";
    case "accepted":
      return "outline";
    case "completed":
      return "default";
    case "confirmed":
      return "default";
    default:
      return "secondary";
  }
}

export default function ErrandsPage() {
  const api = useApi();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]>("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [detail, setDetail] = useState<ErrandDetailRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 500);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  const { data, error, isLoading, run } = useAsync(() =>
    getErrandList(
      {
        search: debouncedSearch,
        status: statusFilter,
        page,
        limit: 10,
      },
      api,
    ),
    { executeOnMount: false },
  );

  useEffect(() => {
    void run();
  }, [api, debouncedSearch, statusFilter, page, run]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }

    const errandId = selectedId;
    let ignore = false;

    async function loadDetail() {
      setDetailLoading(true);
      setDetailError(null);

      try {
        const nextDetail = await getErrandById(errandId, api);

        if (!ignore) {
          setDetail(nextDetail);
        }
      } catch (detailError) {
        if (!ignore) {
          setDetail(null);
          setDetailError(
            detailError instanceof Error ? detailError.message : "Unable to load errand details.",
          );
        }
      } finally {
        if (!ignore) {
          setDetailLoading(false);
        }
      }
    }

    void loadDetail();

    return () => {
      ignore = true;
    };
  }, [api, selectedId]);

  const errands = data?.errands ?? [];
  const totalPages = data?.totalPages ?? 1;

  const selectedErrand = useMemo(() => {
    if (detail) return detail;
    if (!selectedId) return null;
    return errands.find((item) => item.id === selectedId) ?? null;
  }, [detail, errands, selectedId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Errand Management</h1>
          <p className="text-sm text-muted-foreground">
            Review active errands, status changes, assignments, and client activity across the platform.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Search and filter errands before reviewing details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              type="search"
              value={search}
              placeholder="Search by title or description"
              onChange={(event) => setSearch(event.target.value)}
            />

            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as (typeof STATUS_OPTIONS)[number]);
                setPage(1);
              }}
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status === "all" ? "All status" : status.replace(/_/g, " ")}
                </option>
              ))}
            </select>

            <Button
              variant="secondary"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setPage(1);
              }}
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Errands</CardTitle>
            <CardDescription>{data?.totalCount ?? 0} errands match the current filters.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-0 pb-3">
            {error ? (
              <p className="px-6 text-sm text-destructive">Unable to load errands. {error.message}</p>
            ) : isLoading ? (
              <p className="px-6 text-sm text-muted-foreground">Loading errands…</p>
            ) : errands.length === 0 ? (
              <p className="px-6 text-sm text-muted-foreground">No errands match the selected filters.</p>
            ) : (
              <div className="divide-y divide-border">
                {errands.map((errand) => (
                  <button
                    key={errand.id}
                    type="button"
                    onClick={() => setSelectedId(errand.id)}
                    className={`flex w-full flex-col gap-2 px-6 py-4 text-left transition-colors hover:bg-muted/50 ${
                      selectedErrand?.id === errand.id ? "bg-muted/60" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{errand.title ?? "Untitled errand"}</p>
                        <p className="text-sm text-muted-foreground">{errand.description ?? "No description"}</p>
                      </div>
                      <Badge variant={getStatusVariant(errand.status)}>{errand.status ?? "unknown"}</Badge>
                    </div>

                    <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-3">
                      <span>
                        <span className="font-medium text-foreground">ID:</span> {errand.id}
                      </span>
                      <span>
                        <span className="font-medium text-foreground">Client:</span>{" "}
                        {errand.clientEmail ?? "No client email"}
                      </span>
                      <span>
                        <span className="font-medium text-foreground">Runner:</span>{" "}
                        {errand.assignedRunnerId ? errand.runnerName ?? errand.runnerEmail ?? "Runner assigned" : "Unassigned"}
                      </span>
                      <span>
                        <span className="font-medium text-foreground">Amount:</span> ₦{formatAmount(errand.price)}
                      </span>
                      <span>
                        <span className="font-medium text-foreground">Status:</span> {errand.status ?? "unknown"}
                      </span>
                      <span>
                        <span className="font-medium text-foreground">Created:</span> {formatDate(errand.createdAt)}
                      </span>
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
            <CardTitle>{selectedErrand ? selectedErrand.title ?? "Errand details" : "Errand details"}</CardTitle>
            <CardDescription>
              {selectedErrand ? `ID: ${selectedErrand.id}` : "Select an errand to view details."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {detailLoading ? (
              <p className="text-sm text-muted-foreground">Loading errand details…</p>
            ) : detailError ? (
              <p className="text-sm text-destructive">Unable to load errand details. {detailError}</p>
            ) : selectedErrand ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <Badge variant={getStatusVariant(selectedErrand.status)}>{selectedErrand.status ?? "unknown"}</Badge>
                  <span className="text-sm text-muted-foreground">{formatDate(selectedErrand.createdAt)}</span>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p>{selectedErrand.description ?? "No description provided."}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Price</p>
                    <p className="font-medium">₦{formatAmount(selectedErrand.price)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Payout</p>
                    <p className="font-medium">₦{formatAmount(selectedErrand.payoutAmount)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Client</p>
                    <p className="font-medium">{selectedErrand.clientEmail ?? "No client email"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Assigned runner</p>
                    <p className="font-medium">
                      {selectedErrand.assignedRunnerId
                        ? selectedErrand.runnerName ?? selectedErrand.runnerEmail ?? "Runner assigned"
                        : "Unassigned"}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs uppercase text-muted-foreground">Escrow</p>
                  <Badge variant={selectedErrand.escrowStatus ? "outline" : "secondary"}>
                    {selectedErrand.escrowStatus ?? "—"}
                  </Badge>
                </div>

                {selectedErrand.assignedRunnerId && selectedErrand.runnerVerified !== undefined ? (
                  <div className="space-y-2">
                    <p className="text-xs uppercase text-muted-foreground">Runner verification</p>
                    <Badge variant={selectedErrand.runnerVerified ? "default" : "secondary"}>
                      {selectedErrand.runnerVerified ? "Verified" : "Unverified"}
                    </Badge>
                  </div>
                ) : null}

                {"client" in selectedErrand && (selectedErrand as ErrandDetailRecord).client ? (
                  <div className="rounded-lg border border-border bg-muted/40 p-3">
                    <p className="mb-2 text-sm font-medium">Client details</p>
                    <p className="text-sm text-muted-foreground">
                      {(selectedErrand as ErrandDetailRecord).client?.email ?? "No email on file"}
                    </p>
                  </div>
                ) : null}

                {"runner" in selectedErrand && (selectedErrand as ErrandDetailRecord).runner ? (
                  <div className="rounded-lg border border-border bg-muted/40 p-3">
                    <p className="mb-2 text-sm font-medium">Runner details</p>
                    <p className="text-sm text-muted-foreground">
                      {(selectedErrand as ErrandDetailRecord).runner?.name ?? "Unnamed runner"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {(selectedErrand as ErrandDetailRecord).runner?.email ?? "No runner email"}
                    </p>
                  </div>
                ) : null}

                {"events" in selectedErrand && (selectedErrand as ErrandDetailRecord).events?.length ? (
                  <div className="space-y-3">
                    <p className="text-xs uppercase text-muted-foreground">Timeline</p>
                    <div className="space-y-2">
                      {(selectedErrand as ErrandDetailRecord).events.map((event) => (
                        <div key={event.id} className="rounded-lg border border-border p-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium text-sm">{event.eventType}</span>
                            <span className="text-xs text-muted-foreground">{formatDate(event.createdAt)}</span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {event.fromStatus ?? "—"} → {event.toStatus ?? "—"}
                          </p>
                          {event.actorRole ? (
                            <p className="mt-1 text-xs text-muted-foreground">Actor: {event.actorRole}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Select an errand to view details.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
