"use client";

import { ArrowRight, Check, Copy, Mail } from "lucide-react";
import { useState } from "react";

type Status = "idle" | "loading" | "success" | "error";

export default function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [referralLink, setReferralLink] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleJoin() {
    if (!email || status === "loading" || status === "success") return;

    setStatus("loading");
    setError("");

    try {
      const referralCode = new URLSearchParams(window.location.search).get("ref");
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, referralCode }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "Something went wrong. Please try again.");
      }

      const returnedReferralCode = payload?.data?.referral_code;

      if (returnedReferralCode) {
        setReferralLink(
          `${window.location.origin}/waitlist?ref=${returnedReferralCode}`
        );
      }

      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }

  async function copyReferralLink() {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div>
      <div className="flex flex-col gap-2 rounded-[24px] bg-white p-2 shadow-[0_24px_60px_rgba(0,0,0,0.25)] sm:flex-row">
        <div className="flex min-w-0 flex-1 items-center gap-3 px-4">
          <Mail size={19} className="shrink-0 text-[#19a957]" />
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleJoin();
            }}
            placeholder="Enter your email"
            autoComplete="email"
            disabled={status === "loading" || status === "success"}
            className="min-w-0 flex-1 bg-transparent py-3.5 text-sm text-[#101512] outline-none placeholder:text-[#87918a]"
          />
        </div>

        <button
          type="button"
          onClick={handleJoin}
          disabled={!email || status === "loading" || status === "success"}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#19c963] px-6 py-3.5 text-sm font-bold text-[#07110b] transition hover:bg-[#16b95a] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "loading"
            ? "Joining..."
            : status === "success"
              ? "You're on the list"
              : "Join the waitlist"}
          {status === "success" ? <Check size={17} /> : <ArrowRight size={17} />}
        </button>
      </div>

      {status === "error" && (
        <p className="mt-4 text-sm text-red-300">{error}</p>
      )}

      {referralLink && (
        <div className="mt-6 rounded-[22px] border border-white/10 bg-white/5 p-5 text-left">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/40">
            Invite friends
          </p>
          <p className="mt-2 text-sm leading-6 text-white/60">
            Share your referral link and help move ERS closer to launch.
          </p>
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-2">
            <span className="min-w-0 flex-1 truncate px-2 text-sm text-[#66e38f]">
              {referralLink}
            </span>
            <button
              type="button"
              onClick={copyReferralLink}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/15"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
