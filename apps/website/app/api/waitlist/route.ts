import { NextResponse } from "next/server.js";

export async function POST() {
  return NextResponse.json(
    { ok: false, error: "Waitlist signups are closed." },
    {
      status: 410,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
