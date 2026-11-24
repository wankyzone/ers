import { NextResponse } from "next/server.js";

export async function POST() {
  return NextResponse.json({
    error: "Errand creation is not available through this endpoint yet.",
  }, {
    status: 501,
    headers: { "Cache-Control": "no-store" },
  });
}