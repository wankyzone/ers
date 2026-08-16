"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useApi } from "@/hooks/useApi";
import { useAsync } from "@/hooks/useAsync";
import {
  approveKyc,
  getKycDocuments,
  getPendingKycs,
  rejectKyc,
  type KycDocumentMap,
  type KycStatus,
  type KycSubmission,
} from "@/lib/api/kyc";

function formatDate(value?: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function maskAccountNumber(value?: string | null): string {
  if (!value) {
    return "—";
  }

  const trimmed = value.trim();

  if (trimmed.length <= 4) {
    return `••${trimmed.slice(-2)}`;
  }

  return `•••• ${trimmed.slice(-4)}`;
}

function maskBvn(value?: string | null): string {
  if (!value) {
    return "—";
  }

  const trimmed = value.trim();

  if (trimmed.length <= 4) {
    return `••${trimmed.slice(-2)}`;
  }

  return `••••${trimmed.slice(-4)}`;
}

function getStatusVariant(status: KycStatus): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "approved":
      return "default";
    case "rejected":
      return "destructive";
    case "pending":
    default:
      return "secondary";
  }
}

function DocumentViewer({
  documents,
  loading,
  error,
}: {
  documents: KycDocumentMap | null;
  loading: boolean;
  error: string | null;
}) {
  const items = [
    { key: "nin", label: "NIN", value: documents?.nin },
    { key: "proofOfAddress", label: "Proof of address", value: documents?.proofOfAddress },
    { key: "selfie", label: "Selfie", value: documents?.selfie },
  ] as const;

  if (loading) {
    return <p>Loading documents…</p>;
  }

  if (error) {
    return <p className="text-destructive">Unable to load documents. {error}</p>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <Card key={item.key} size="sm">
          <CardHeader>
            <CardTitle>{item.label}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {item.value ? (
              <>
                <a
                  href={item.value}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  Open document
                </a>
                <div className="overflow-hidden rounded-md border border-border bg-muted/40">
                  {item.value.toLowerCase().includes(".pdf") ? (
                    <iframe
                      src={item.value}
                      title={item.label}
                      className="h-56 w-full bg-white"
                    />
                  ) : (
                    <img
                      src={item.value}
                      alt={item.label}
                      className="h-56 w-full object-cover"
                    />
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Document not uploaded.</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function KycPage() {
  const api = useApi();
  const {
    data: queue,
    error,
    isLoading,
    run: reloadQueue,
  } = useAsync(() => getPendingKycs(api));

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<KycDocumentMap | null>(null);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectValidationError, setRejectValidationError] = useState("");
  const [actionState, setActionState] = useState<{
    type: "approve" | "reject" | null;
    loading: boolean;
    success: string | null;
    error: string | null;
  }>({
    type: null,
    loading: false,
    success: null,
    error: null,
  });

  const selectedSubmission = useMemo(() => {
    if (!queue || queue.length === 0) {
      return null;
    }

    if (selectedId && queue.some((item) => item.id === selectedId)) {
      return queue.find((item) => item.id === selectedId) ?? queue[0];
    }

    return queue[0];
  }, [queue, selectedId]);

  useEffect(() => {
    const activeId = selectedSubmission?.id ?? null;

    if (!activeId) {
      setDocuments(null);
      setDocumentsError(null);
      setDocumentsLoading(false);
      return;
    }

    const documentId = activeId;
    let ignore = false;

    async function loadDocuments() {
      setDocumentsLoading(true);
      setDocumentsError(null);

      try {
        const nextDocuments = await getKycDocuments(documentId, api);

        if (!ignore) {
          setDocuments(nextDocuments);
        }
      } catch (documentError) {
        if (!ignore) {
          setDocuments(null);
          setDocumentsError(
            documentError instanceof Error ? documentError.message : "Unable to load documents.",
          );
        }
      } finally {
        if (!ignore) {
          setDocumentsLoading(false);
        }
      }
    }

    void loadDocuments();

    return () => {
      ignore = true;
    };
  }, [api, selectedSubmission?.id]);

  const handleApprove = async () => {
    const activeId = selectedSubmission?.id ?? null;

    if (!activeId || actionState.loading) {
      return;
    }

    setActionState({ type: "approve", loading: true, success: null, error: null });

    try {
      await approveKyc(activeId, api);
      const refreshedQueue = await reloadQueue();
      const nextSelectedId = refreshedQueue && refreshedQueue.length > 0
        ? (selectedId && refreshedQueue.some((item) => item.id === selectedId) ? selectedId : refreshedQueue[0].id)
        : null;

      setSelectedId(nextSelectedId);
      setActionState({
        type: "approve",
        loading: false,
        success: "KYC approved successfully.",
        error: null,
      });
      setRejectReason("");
      setRejectValidationError("");
    } catch (approveError) {
      setActionState({
        type: "approve",
        loading: false,
        success: null,
        error: approveError instanceof Error ? approveError.message : "Unable to approve this KYC.",
      });
    }
  };

  const handleReject = async () => {
    const activeId = selectedSubmission?.id ?? null;

    if (!activeId || actionState.loading) {
      return;
    }

    const trimmedReason = rejectReason.trim();

    if (!trimmedReason) {
      setRejectValidationError("A rejection reason is required.");
      return;
    }

    setRejectValidationError("");
    setActionState({ type: "reject", loading: true, success: null, error: null });

    try {
      await rejectKyc(activeId, trimmedReason, api);
      const refreshedQueue = await reloadQueue();
      const nextSelectedId = refreshedQueue && refreshedQueue.length > 0
        ? (selectedId && refreshedQueue.some((item) => item.id === selectedId) ? selectedId : refreshedQueue[0].id)
        : null;

      setSelectedId(nextSelectedId);
      setActionState({
        type: "reject",
        loading: false,
        success: "KYC rejected successfully.",
        error: null,
      });
      setRejectReason("");
    } catch (rejectError) {
      setActionState({
        type: "reject",
        loading: false,
        success: null,
        error: rejectError instanceof Error ? rejectError.message : "Unable to reject this KYC.",
      });
    }
  };

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">KYC Reviews</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review runner submissions and approve or reject them from the production KYC workflow.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Pending queue</CardTitle>
            <CardDescription>{queue?.length ?? 0} awaiting review</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error ? (
              <p className="text-sm text-destructive">
                Unable to load pending KYC submissions. {error.message}
              </p>
            ) : isLoading ? (
              <p className="text-sm text-muted-foreground">Loading pending KYC submissions…</p>
            ) : queue && queue.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                No pending KYC applications at the moment.
              </div>
            ) : (
              <div className="space-y-3">
                {queue?.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      selectedSubmission?.id === item.id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{item.full_name || "Unnamed runner"}</p>
                        <p className="text-xs text-muted-foreground">{item.phone || "No phone on file"}</p>
                      </div>
                      <Badge variant={getStatusVariant(item.status)}>{item.status}</Badge>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Submitted</span>
                      <span>{formatDate(item.created_at)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{selectedSubmission ? selectedSubmission.full_name || "KYC submission" : "KYC details"}</CardTitle>
            {selectedSubmission ? (
              <CardDescription>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={getStatusVariant(selectedSubmission.status)}>
                    {selectedSubmission.status}
                  </Badge>
                  <span>{formatDate(selectedSubmission.created_at)}</span>
                </div>
              </CardDescription>
            ) : null}
          </CardHeader>

          <CardContent className="space-y-6">
            {!selectedSubmission ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                Select a submission to review its details.
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Full name</p>
                    <p className="mt-1 font-medium">{selectedSubmission.full_name || "Not provided"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Phone</p>
                    <p className="mt-1 font-medium">{selectedSubmission.phone || "Not provided"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Account name</p>
                    <p className="mt-1 font-medium">{selectedSubmission.account_name || "Not provided"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Bank code</p>
                    <p className="mt-1 font-medium">{selectedSubmission.bank_code || "Not provided"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Account number</p>
                    <p className="mt-1 font-medium">{maskAccountNumber(selectedSubmission.account_number)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">BVN</p>
                    <p className="mt-1 font-medium">{maskBvn(selectedSubmission.bvn)}</p>
                  </div>
                </div>

                {selectedSubmission.rejection_reason ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                    <p className="font-medium text-destructive">Rejection reason</p>
                    <p className="mt-1 text-foreground">{selectedSubmission.rejection_reason}</p>
                  </div>
                ) : null}

                <div>
                  <h2 className="text-base font-semibold">Documents</h2>
                  <div className="mt-3">
                    <DocumentViewer
                      documents={documents}
                      loading={documentsLoading}
                      error={documentsError}
                    />
                  </div>
                </div>
              </>
            )}
          </CardContent>

          {selectedSubmission ? (
            <CardFooter className="flex-col items-stretch gap-4 border-t bg-muted/20 p-4">
              {actionState.success ? (
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
                  {actionState.success}
                </div>
              ) : null}

              {actionState.error ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {actionState.error}
                </div>
              ) : null}

              <div className="space-y-3">
                <label className="block text-sm font-medium" htmlFor="rejection-reason">
                  Rejection reason
                </label>
                <textarea
                  id="rejection-reason"
                  value={rejectReason}
                  onChange={(event) => {
                    setRejectReason(event.target.value);
                    if (rejectValidationError) {
                      setRejectValidationError("");
                    }
                  }}
                  placeholder="Enter a reason for rejecting this KYC submission"
                  disabled={actionState.loading}
                  className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
                />
                {rejectValidationError ? (
                  <p className="text-sm text-destructive">{rejectValidationError}</p>
                ) : null}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  variant="default"
                  onClick={handleApprove}
                  disabled={actionState.loading}
                  className="flex-1"
                >
                  {actionState.loading && actionState.type === "approve" ? "Approving…" : "Approve KYC"}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleReject}
                  disabled={actionState.loading}
                  className="flex-1"
                >
                  {actionState.loading && actionState.type === "reject" ? "Rejecting…" : "Reject KYC"}
                </Button>
              </div>
            </CardFooter>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
