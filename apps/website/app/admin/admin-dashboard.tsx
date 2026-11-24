"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

type WaitlistRow = {
  email: string;
  created_at: string;
  referral_code: string | null;
  referred_by: string | null;
  referrals_count: number;
};

type DashboardData = {
  rows: WaitlistRow[];
  totalRows: number;
  totalPages: number;
  page: number;
  metrics: {
    totalSignups: number;
    recentSignups: number;
    referralSignups: number;
  };
};

export default function AdminDashboard({
  initiallyAuthorized,
}: {
  initiallyAuthorized: boolean;
}) {
  const [authorized, setAuthorized] = useState(initiallyAuthorized);
  const [password, setPassword] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(initiallyAuthorized);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (authorized === false) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({ page: String(page), search });
        const response = await fetch(`/api/admin-waitlist?${params}`);

        if (response.status === 401) {
          if (!cancelled) setAuthorized(false);
          return;
        }
        if (!response.ok) {
          throw new Error("Unable to load waitlist data. Please try again.");
        }

        const data = (await response.json()) as DashboardData;
        if (!cancelled) {
          setDashboard(data);
          setAuthorized(true);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load waitlist data. Please try again."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [authorized, page, refreshKey, search]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        throw new Error(
          response.status === 503
            ? "Admin authentication is not configured."
            : "Incorrect password. Please try again."
        );
      }

      setPassword("");
      setPage(1);
      setAuthorized(true);
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "Unable to sign in. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/admin-logout", { method: "POST" });
    } catch {
      setError("Unable to contact the server. Your session may still be active.");
    } finally {
      setDashboard(null);
      setAuthorized(false);
    }
  };

  if (authorized !== true) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0B0D12] px-4 text-white">
        <section className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#111217] p-7">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#66e38f]">
            ERS Waitlist
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold">Admin sign in</h1>
          <form onSubmit={handleLogin} className="mt-5">
            <label
              htmlFor="admin-password"
              className="mb-2 block text-sm text-white/70"
            >
              Admin password
            </label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black px-4 py-3 text-white outline-none focus-visible:border-[#19c963]"
            />
            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full rounded-lg bg-[#19c963] px-4 py-3 font-bold text-[#07110b] transition hover:bg-[#16b95a] disabled:opacity-60"
            >
              {loading ? "Checking..." : "Sign in"}
            </button>
          </form>
          {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
        </section>
      </main>
    );
  }

  const metrics = dashboard?.metrics;

  return (
    <main className="min-h-screen bg-[#0B0D12] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#66e38f]">
              ERS Waitlist
            </p>
            <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">
              Admin dashboard
            </h1>
          </div>
          <div className="flex gap-3">
            <a
              href={`/api/admin-waitlist/export?search=${encodeURIComponent(search)}`}
              className="rounded-lg bg-[#19c963] px-4 py-2.5 text-sm font-bold text-[#07110b] transition hover:bg-[#16b95a]"
            >
              Export CSV
            </a>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-semibold hover:bg-white/5"
            >
              Logout
            </button>
          </div>
        </header>

        <section aria-label="Waitlist metrics" className="mb-8 grid gap-4 sm:grid-cols-3">
          {[
            { label: "Total signups", value: metrics?.totalSignups },
            {
              label: "Signups in the last 7 days",
              value: metrics?.recentSignups,
            },
            {
              label: "Signups via referral",
              value: metrics?.referralSignups,
            },
          ].map(({ label, value }) => (
            <article
              key={label}
              className="rounded-xl border border-white/10 bg-[#111217] p-5"
            >
              <h2 className="text-sm text-white/55">{label}</h2>
              <p className="mt-2 text-3xl font-bold text-[#66e38f]">
                {value ?? "—"}
              </p>
            </article>
          ))}
        </section>

        <section className="rounded-xl border border-white/10 bg-[#111217] p-4 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Waitlist signups</h2>
              <p className="mt-1 text-sm text-white/50">
                {dashboard
                  ? `${dashboard.totalRows.toLocaleString()} matching signups`
                  : "Search and review signups"}
              </p>
            </div>
            <label className="w-full sm:max-w-sm">
              <span className="sr-only">Search email</span>
              <input
                type="search"
                placeholder="Search email..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-white/10 bg-black px-4 py-2.5 text-sm outline-none focus-visible:border-[#19c963]"
              />
            </label>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-200"
            >
              <span>{error}</span>
              <button
                onClick={() => setRefreshKey((currentKey) => currentKey + 1)}
                className="font-semibold underline"
              >
                Retry
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-white/10 text-white/50">
                <tr>
                  <th className="px-3 py-3 font-medium">Email</th>
                  <th className="px-3 py-3 font-medium">Signed up</th>
                  <th className="px-3 py-3 font-medium">Referral code</th>
                  <th className="px-3 py-3 font-medium">Referred by</th>
                  <th className="px-3 py-3 text-right font-medium">
                    Referrals received
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {dashboard?.rows.map((row) => (
                  <tr key={`${row.email}-${row.created_at}`}>
                    <td className="px-3 py-3">{row.email}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-white/65">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-white/65">
                      {row.referral_code || "—"}
                    </td>
                    <td className="px-3 py-3 text-white/65">
                      {row.referred_by || "—"}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {row.referrals_count ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {loading && (
            <p role="status" className="py-8 text-center text-sm text-white/55">
              Loading waitlist...
            </p>
          )}
          {!loading && !error && dashboard?.rows.length === 0 && (
            <p className="py-10 text-center text-sm text-white/55">
              {search
                ? "No signups match your search."
                : "No one has joined the waitlist yet."}
            </p>
          )}

          <footer className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-sm">
            <p className="text-white/50">
              Page {dashboard?.page ?? page} of {dashboard?.totalPages ?? 1}
            </p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1 || loading}
                onClick={() => setPage((currentPage) => currentPage - 1)}
                className="rounded-md border border-white/10 px-3 py-2 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= (dashboard?.totalPages ?? 1) || loading}
                onClick={() => setPage((currentPage) => currentPage + 1)}
                className="rounded-md border border-white/10 px-3 py-2 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
}
