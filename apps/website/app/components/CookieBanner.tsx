"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";

type Consent = "accepted" | "declined" | null;

function getConsent(): Consent {
  if (typeof window === "undefined") return null;

  const value = localStorage.getItem("ers_cookie_consent");
  return value === "accepted" || value === "declined"
    ? value
    : null;
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("ers-consent-changed", callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("ers-consent-changed", callback);
  };
}

export default function CookieBanner() {
  const consent = useSyncExternalStore(subscribe, getConsent, () => null);

  const updateConsent = (value: "accepted" | "declined") => {
    localStorage.setItem("ers_cookie_consent", value);

    // 🔥 notify subscribers
    window.dispatchEvent(new Event("ers-consent-changed"));
  };

  if (consent !== null) return null;

  return (
    <div className="fixed bottom-0 left-0 w-full z-50 px-4 pb-4">
      <div className="
        max-w-6xl mx-auto
        bg-[#111217] border border-white/10
        rounded-xl shadow-lg
        p-4 sm:p-5
        flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4
      ">

        <p className="text-sm text-white/70 leading-relaxed">
          We use cookies to improve your experience, analyze usage, and keep ERS secure.{" "}
          <Link href="/cookie-policy" className="underline text-white">
            Learn more
          </Link>
        </p>

        <div className="flex gap-3 w-full sm:w-auto">
          <button
            onClick={() => updateConsent("declined")}
            className="flex-1 sm:flex-none px-4 py-2 border border-white/20 text-white/80 text-sm rounded-md hover:bg-white/5 transition"
          >
            Decline
          </button>

          <button
            onClick={() => updateConsent("accepted")}
            className="flex-1 sm:flex-none px-4 py-2 bg-[#1ED760] text-black text-sm font-semibold rounded-md hover:bg-[#17c253] transition"
          >
            Accept
          </button>
        </div>

      </div>
    </div>
  );
}