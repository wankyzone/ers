import { NextResponse } from "next/server.js";
import { isAdminRequest } from "../../../../lib/admin-authorization.ts";
import {
  createWaitlistCsv,
  getWaitlistExportRows,
} from "../../../../lib/admin-waitlist.ts";
import {
  isWaitlistAdminEnabled,
  waitlistAdminUnavailableResponse,
} from "../../../../lib/waitlist-admin-access.ts";

export async function GET(request: Request) {
  if (!isWaitlistAdminEnabled()) return waitlistAdminUnavailableResponse();

  if (!(await isAdminRequest(request))) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const search = (new URL(request.url).searchParams.get("search") ?? "")
    .trim()
    .slice(0, 100);

  try {
    const rows = await getWaitlistExportRows(search);
    return new Response(createWaitlistCsv(rows), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": 'attachment; filename="ers-waitlist.csv"',
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Admin waitlist export failed:", error);
    return NextResponse.json(
      { error: "Unable to export waitlist data" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
