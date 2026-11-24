"use client";

import { useSyncExternalStore } from "react";
import { GoogleAnalytics } from "@next/third-parties/google";

type Consent = "accepted" | "declined" | null;

// 🔥 External store (no React state needed)
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

export default function Analytics() {
  const consent = useSyncExternalStore(subscribe, getConsent, () => null);

  if (consent !== "accepted") return null;

  return <GoogleAnalytics gaId="G-X8KBSSB2ZH" />;
}