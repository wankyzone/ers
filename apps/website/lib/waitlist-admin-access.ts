import { NextResponse } from "next/server.js";

export function isWaitlistAdminEnabled() {
  return process.env.ERS_WAITLIST_ADMIN_ENABLED === "true";
}

export function waitlistAdminUnavailableResponse() {
  return NextResponse.json(
    { error: "Waitlist administration is unavailable." },
    {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
