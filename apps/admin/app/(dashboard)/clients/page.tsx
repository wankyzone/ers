"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useApi } from "@/hooks/useApi";
import { useAsync } from "@/hooks/useAsync";
import {
  getClientActivity,
  getClientList,
  type ClientAccountStatusFilter,
  type ClientRecord,
} from "@/lib/api/clients";

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

function getVerificationVariant(verified: boolean) {
  return verified ? "default" : "secondary";
}

function getAccountStatusVariant(
  status: ClientRecord["accountStatus"],
) {
  return status === "verified" ? "default" : "secondary";
}

function formatEventType(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function ClientsPage() {
  const api = useApi();

  const [search, setSearch] = useState("");
  const [accountStatusFilter, setAccountStatusFilter] =
    useState<ClientAccountStatusFilter>("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, error, isLoading, run } = useAsync(
    () =>
      getClientList(
        {
          search,
          accountStatus: accountStatusFilter,
          page,
          limit: 10,
        },
        api,
      ),
    { executeOnMount: false },
  );

  useEffect(() => {
    void run();
  }, [run, search, accountStatusFilter, page]);

  const clients = data?.clients ?? [];
  const totalPages = data?.totalPages ?? 1;

  const selectedClient = useMemo(() => {
    if (!selectedId) {
      return clients[0] ?? null;
    }

    return (
      clients.find((client) => client.id === selectedId) ??
      clients[0] ??
      null
    );
  }, [clients, selectedId]);

  const {
    data: activityData,
    error: activityError,
    isLoading: activityLoading,
    run: runActivity,
  } = useAsync(
    () =>
      selectedClient
        ? getClientActivity(selectedClient.id, { page: 1, limit: 20 }, api)
        : Promise.resolve({
            activities: [],
            totalCount: 0,
            page: 1,
            limit: 20,
            totalPages: 1,
          }),
    { executeOnMount: false },
  );

  useEffect(() => {
    if (selectedClient?.id) {
      void runActivity();
    }
  }, [runActivity, selectedClient?.id]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Client Management
          </h1>

          <p className="text-sm text-muted-foreground">
            Monitor client accounts, verification status, activity, and
            marketplace usage.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>

          <CardDescription>
            Search and narrow the client roster by account status.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              type="search"
              value={search}
              placeholder="Search by name, email, or phone"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
                setSelectedId(null);
              }}
            />

            <select
              value={accountStatusFilter}
              onChange={(event) => {
                setAccountStatusFilter(
                  event.target.value as ClientAccountStatusFilter,
                );
                setPage(1);
                setSelectedId(null);
              }}
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
            >
              <option value="all">All account status</option>
              <option value="verified">Verified</option>
              <option value="unverified">Unverified</option>
              <option value="pending">Pending</option>
            </select>

            <Button
              variant="secondary"
              onClick={() => {
                setSearch("");
                setAccountStatusFilter("all");
                setPage(1);
                setSelectedId(null);
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
            <CardTitle>Client roster</CardTitle>

            <CardDescription>
              {data?.totalCount ?? 0} clients match the current filters.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 p-0 pb-3">
            {error ? (
              <p className="px-6 text-sm text-destructive">
                Unable to load clients. {error.message}
              </p>
            ) : isLoading ? (
              <p className="px-6 text-sm text-muted-foreground">
                Loading clients…
              </p>
            ) : clients.length === 0 ? (
              <p className="px-6 text-sm text-muted-foreground">
                No clients match the selected criteria.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {clients.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => setSelectedId(client.id)}
                    className={`flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition-colors hover:bg-muted/50 ${
                      selectedClient?.id === client.id ? "bg-muted/60" : ""
                    }`}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">
                          {client.fullName ?? "Unnamed client"}
                        </span>

                        <Badge
                          variant={getAccountStatusVariant(
                            client.accountStatus,
                          )}
                        >
                          {client.accountStatus}
                        </Badge>
                      </div>

                      <p className="truncate text-sm text-muted-foreground">
                        {client.email ?? client.phone ?? "No contact on file"}
                      </p>
                    </div>

                    <Badge
                      variant={getVerificationVariant(client.verified)}
                    >
                      {client.verified ? "Verified" : "Unverified"}
                    </Badge>
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between px-6 pt-3">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || isLoading}
                onClick={() =>
                  setPage((current) => Math.max(1, current - 1))
                }
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
                onClick={() =>
                  setPage((current) =>
                    Math.min(totalPages, current + 1),
                  )
                }
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {selectedClient?.fullName ?? "Client details"}
            </CardTitle>

            <CardDescription>
              {selectedClient
                ? `ID: ${selectedClient.id}`
                : "No client selected"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {selectedClient ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">
                      Verification
                    </p>

                    <Badge
                      variant={getVerificationVariant(
                        selectedClient.verified,
                      )}
                    >
                      {selectedClient.verified
                        ? "Verified"
                        : "Unverified"}
                    </Badge>
                  </div>

                  <div>
                    <p className="text-xs uppercase text-muted-foreground">
                      Account status
                    </p>

                    <Badge
                      variant={getAccountStatusVariant(
                        selectedClient.accountStatus,
                      )}
                    >
                      {selectedClient.accountStatus}
                    </Badge>
                  </div>
                </div>

                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Email</dt>
                    <dd className="text-right">
                      {selectedClient.email ?? "—"}
                    </dd>
                  </div>

                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Phone</dt>
                    <dd className="text-right">
                      {selectedClient.phone ?? "—"}
                    </dd>
                  </div>

                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Role</dt>
                    <dd className="text-right">
                      {selectedClient.role ?? "—"}
                    </dd>
                  </div>

                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Created</dt>
                    <dd className="text-right">
                      {formatDate(selectedClient.createdAt)}
                    </dd>
                  </div>

                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Errands</dt>
                    <dd className="text-right">
                      {selectedClient.totalErrands}
                    </dd>
                  </div>

                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">
                      Wallet balance
                    </dt>
                    <dd className="text-right">
                      ₦{selectedClient.walletBalance.toLocaleString()}
                    </dd>
                  </div>
                </dl>

                <div className="border-t pt-5">
                  <div className="mb-4">
                    <h3 className="font-medium">Recent activity</h3>
                    <p className="text-sm text-muted-foreground">
                      Recent events across this client&apos;s errands.
                    </p>
                  </div>

                  {activityError ? (
                    <p className="text-sm text-destructive">
                      Unable to load client activity. {activityError.message}
                    </p>
                  ) : activityLoading ? (
                    <p className="text-sm text-muted-foreground">
                      Loading activity…
                    </p>
                  ) : activityData?.activities.length ? (
                    <div className="space-y-4">
                      {activityData.activities.map((activity) => (
                        <div
                          key={activity.id}
                          className="relative border-l pl-4"
                        >
                          <div className="space-y-1">
                            <p className="text-sm font-medium">
                              {formatEventType(activity.eventType)}
                            </p>

                            {(activity.fromStatus || activity.toStatus) && (
                              <p className="text-xs text-muted-foreground">
                                {activity.fromStatus ?? "—"} →{" "}
                                {activity.toStatus ?? "—"}
                              </p>
                            )}

                            <p className="text-xs text-muted-foreground">
                              {formatDate(activity.createdAt)}
                              {activity.actorRole
                                ? ` · ${activity.actorRole}`
                                : ""}
                            </p>

                            <p className="text-xs text-muted-foreground">
                              Errand: {activity.errandId}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No activity recorded yet.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a client to view details.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
